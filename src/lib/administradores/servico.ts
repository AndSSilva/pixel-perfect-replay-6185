import { supabase } from "@/integrations/supabase/client";
import {
  criarAdministradorFn,
  listarAdministradoresFn,
  redefinirSenhaProvisoriaFn,
} from "./administradores.functions";
import {
  MENSAGENS_ADMIN,
  type AdministradorListado,
  type CodigoErroAdmin,
  type RespostaAdmin,
} from "./tipos";

export class ErroAdmin extends Error {
  constructor(public readonly codigo: CodigoErroAdmin) {
    super(MENSAGENS_ADMIN[codigo]);
    this.name = "ErroAdmin";
  }
}

function desembrulhar<T>(r: RespostaAdmin<T>): T {
  if (!r.ok) throw new ErroAdmin(r.codigo);
  return r.dados;
}

export const CHAVE_ADMINISTRADORES = ["administradores"] as const;

export async function listarAdministradores(): Promise<AdministradorListado[]> {
  return desembrulhar(await listarAdministradoresFn());
}

export async function criarAdministrador(dados: {
  email: string;
  senhaProvisoria: string;
  empresaIds: string[];
}) {
  return desembrulhar(await criarAdministradorFn({ data: dados }));
}

export async function redefinirSenhaProvisoria(dados: {
  usuarioId: string;
  senhaProvisoria: string;
}) {
  return desembrulhar(await redefinirSenhaProvisoriaFn({ data: dados }));
}

/**
 * Ajusta os vínculos do administrador para exatamente `empresaIds`. Roda no navegador do master:
 * a regra de acesso do banco só permite ao master inserir e remover vínculos.
 */
export async function definirVinculos(
  usuarioId: string,
  empresaIds: readonly string[],
): Promise<void> {
  const atuais = await supabase
    .from("estabelecimento_membros")
    .select("estabelecimento_id")
    .eq("user_id", usuarioId);
  if (atuais.error) {
    console.error("[administradores] vinculos", {
      codigo: atuais.error.code,
      mensagem: atuais.error.message,
    });
    throw new ErroAdmin(atuais.error.code === "42501" ? "sem_permissao" : "desconhecido");
  }
  const antes = new Set(atuais.data.map((v) => v.estabelecimento_id));
  const depois = new Set(empresaIds);
  const incluir = [...depois].filter((id) => !antes.has(id));
  const remover = [...antes].filter((id) => !depois.has(id));

  if (incluir.length > 0) {
    const r = await supabase
      .from("estabelecimento_membros")
      .insert(incluir.map((id) => ({ estabelecimento_id: id, user_id: usuarioId })));
    if (r.error) {
      console.error("[administradores] incluir", {
        codigo: r.error.code,
        mensagem: r.error.message,
      });
      throw new ErroAdmin(
        r.error.code === "23503"
          ? "empresa_invalida"
          : r.error.code === "42501"
            ? "sem_permissao"
            : "desconhecido",
      );
    }
  }
  if (remover.length > 0) {
    const r = await supabase
      .from("estabelecimento_membros")
      .delete()
      .eq("user_id", usuarioId)
      .in("estabelecimento_id", remover);
    if (r.error) {
      console.error("[administradores] remover", {
        codigo: r.error.code,
        mensagem: r.error.message,
      });
      throw new ErroAdmin(r.error.code === "42501" ? "sem_permissao" : "desconhecido");
    }
  }
}
