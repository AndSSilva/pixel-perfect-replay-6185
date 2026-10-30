import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AdministradorListado, CodigoErroAdmin, RespostaAdmin } from "./tipos";
import { esquemaNovoAdministrador, esquemaRedefinirSenha } from "./validacao";

// Regras da gestão de administradores (só o master). Recebe os clientes por parâmetro para
// poder ser testada sem backend:
//  - usuario: cliente com o token de quem chamou (RLS aplicada) — usado para confirmar que é master;
//  - admin: cliente com a chave de serviço (ignora RLS) — só depois da confirmação.
type Cliente = SupabaseClient<Database>;
export interface Dependencias {
  usuario: Cliente;
  admin: Cliente;
}

const falha = (codigo: CodigoErroAdmin): { ok: false; codigo: CodigoErroAdmin } => ({
  ok: false,
  codigo,
});

async function ehMaster({ usuario }: Dependencias): Promise<boolean> {
  const { data, error } = await usuario.rpc("eh_master");
  return !error && data === true;
}

function codigoDoErroAuth(e: {
  code?: string | undefined;
  message?: string | undefined;
}): CodigoErroAdmin {
  if (e.code === "email_exists" || e.code === "user_already_exists") return "email_em_uso";
  if (e.code === "weak_password") return "senha_invalida";
  if (e.code === "user_not_found") return "usuario_nao_encontrado";
  return "desconhecido";
}

function registrar(etapa: string, e: unknown) {
  const x = e as { name?: string; code?: string; status?: number; message?: string } | null;
  console.error("[administradores]", etapa, {
    nome: x?.name,
    codigo: x?.code,
    status: x?.status,
    mensagem: x?.message,
  });
}

export async function listarAdministradores(
  dep: Dependencias,
): Promise<RespostaAdmin<AdministradorListado[]>> {
  if (!(await ehMaster(dep))) return falha("sem_permissao");
  const { admin } = dep;

  const [perfis, membros, empresas, usuarios] = await Promise.all([
    admin.from("perfis_acesso").select("user_id, deve_trocar_senha").eq("papel", "admin"),
    admin.from("estabelecimento_membros").select("user_id, estabelecimento_id"),
    admin.from("estabelecimentos").select("id, nome, slug"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  for (const r of [perfis, membros, empresas]) {
    if (r.error) {
      registrar("listar", r.error);
      return falha("desconhecido");
    }
  }
  if (usuarios.error) {
    registrar("listUsers", usuarios.error);
    return falha("desconhecido");
  }

  const porId = new Map(usuarios.data.users.map((u) => [u.id, u]));
  const empresaPorId = new Map((empresas.data ?? []).map((e) => [e.id, e]));
  const lista: AdministradorListado[] = [];
  for (const p of perfis.data ?? []) {
    const u = porId.get(p.user_id);
    if (!u) continue; // perfil sem usuário (não deveria ocorrer por causa do cascade)
    lista.push({
      usuarioId: p.user_id,
      email: u.email ?? "",
      deveTrocarSenha: p.deve_trocar_senha,
      criadoEm: u.created_at,
      ultimoAcesso: u.last_sign_in_at ?? null,
      empresas: (membros.data ?? [])
        .filter((m) => m.user_id === p.user_id)
        .flatMap((m) => {
          const e = empresaPorId.get(m.estabelecimento_id);
          return e ? [{ id: e.id, nome: e.nome, slug: e.slug }] : [];
        })
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    });
  }
  lista.sort((a, b) => a.email.localeCompare(b.email, "pt-BR"));
  return { ok: true, dados: lista };
}

export async function criarAdministrador(
  dep: Dependencias,
  entrada: unknown,
): Promise<RespostaAdmin<{ usuarioId: string }>> {
  if (!(await ehMaster(dep))) return falha("sem_permissao");
  const v = esquemaNovoAdministrador.safeParse(entrada);
  if (!v.success)
    return falha(
      v.error.issues.some((i) => i.path[0] === "senhaProvisoria")
        ? "senha_invalida"
        : "dados_invalidos",
    );
  const { email, senhaProvisoria, empresaIds } = v.data;
  const { admin } = dep;

  if (empresaIds.length > 0) {
    const { data, error } = await admin.from("estabelecimentos").select("id").in("id", empresaIds);
    if (error) {
      registrar("empresas", error);
      return falha("desconhecido");
    }
    if ((data ?? []).length !== empresaIds.length) return falha("empresa_invalida");
  }

  const criado = await admin.auth.admin.createUser({
    email,
    password: senhaProvisoria,
    email_confirm: true,
  });
  if (criado.error || !criado.data.user) {
    registrar("createUser", criado.error);
    return falha(codigoDoErroAuth(criado.error ?? {}));
  }
  const usuarioId = criado.data.user.id;

  // Se qualquer etapa seguinte falhar, remove o usuário (o perfil e os vínculos saem em cascata).
  const desfazer = async (
    etapa: string,
    e: unknown,
  ): Promise<RespostaAdmin<{ usuarioId: string }>> => {
    registrar(etapa, e);
    const r = await admin.auth.admin.deleteUser(usuarioId);
    if (r.error) registrar("deleteUser(rollback)", r.error);
    return falha("desconhecido");
  };

  const perfil = await admin
    .from("perfis_acesso")
    .insert({ user_id: usuarioId, papel: "admin", deve_trocar_senha: true });
  if (perfil.error) return desfazer("perfil", perfil.error);

  if (empresaIds.length > 0) {
    const vinculos = await admin
      .from("estabelecimento_membros")
      .insert(empresaIds.map((id) => ({ estabelecimento_id: id, user_id: usuarioId })));
    if (vinculos.error) return desfazer("vinculos", vinculos.error);
  }
  return { ok: true, dados: { usuarioId } };
}

/** Nova senha provisória para um administrador: ele volta a ser obrigado a trocar no próximo acesso. */
export async function redefinirSenhaProvisoria(
  dep: Dependencias,
  entrada: unknown,
): Promise<RespostaAdmin> {
  if (!(await ehMaster(dep))) return falha("sem_permissao");
  const v = esquemaRedefinirSenha.safeParse(entrada);
  if (!v.success)
    return falha(
      v.error.issues.some((i) => i.path[0] === "senhaProvisoria")
        ? "senha_invalida"
        : "dados_invalidos",
    );
  const { usuarioId, senhaProvisoria } = v.data;
  const { admin } = dep;

  const alvo = await admin
    .from("perfis_acesso")
    .select("papel")
    .eq("user_id", usuarioId)
    .maybeSingle();
  if (alvo.error) {
    registrar("alvo", alvo.error);
    return falha("desconhecido");
  }
  if (!alvo.data) return falha("usuario_nao_encontrado");
  if (alvo.data.papel !== "admin") return falha("nao_e_administrador"); // nunca mexe na conta master

  // Marca primeiro: se a senha falhar em seguida, o usuário só fica "obrigado a trocar" (mais seguro).
  const marcado = await admin
    .from("perfis_acesso")
    .update({ deve_trocar_senha: true, atualizado_em: new Date().toISOString() })
    .eq("user_id", usuarioId);
  if (marcado.error) {
    registrar("marcar", marcado.error);
    return falha("desconhecido");
  }
  const r = await admin.auth.admin.updateUserById(usuarioId, { password: senhaProvisoria });
  if (r.error) {
    registrar("updateUserById", r.error);
    return falha(codigoDoErroAuth(r.error));
  }
  return { ok: true, dados: undefined };
}
