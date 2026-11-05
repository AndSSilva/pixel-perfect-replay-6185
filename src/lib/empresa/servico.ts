import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Horarios, Intervalo } from "./horarios";
import { ErroEmpresa, type CodigoErroEmpresa, type Empresa } from "./tipos";

const COLUNAS =
  "id, slug, nome, ativo, cor_primaria, cor_secundaria, logo_url, criado_em, descricao, endereco, horarios, whatsapp, instagram, intervalo";

/** Converte erros do Postgres/PostgREST em códigos nossos. */
export function codigoDoErroEmpresa(
  e: Pick<PostgrestError, "code" | "message">,
): CodigoErroEmpresa {
  if (e.code === "23505") return "slug_duplicado";
  if (e.code === "23514") {
    if (e.message.includes("slug_reservado")) return "slug_reservado";
    if (e.message.includes("slug_formato")) return "slug_formato";
    if (e.message.includes("nome_tamanho")) return "nome_invalido";
    return "dados_invalidos";
  }
  if (e.code === "42501") return "sem_permissao";
  if (e.code === "P0002") return "nao_encontrada";
  return "desconhecido";
}

function falhar(e: PostgrestError): never {
  console.error("[empresa]", { codigo: e.code, mensagem: e.message });
  throw new ErroEmpresa(codigoDoErroEmpresa(e));
}

/** Empresas que a pessoa pode acessar (a regra de acesso do banco decide: master vê todas). */
export async function listarEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase.from("estabelecimentos").select(COLUNAS).order("nome");
  if (error) falhar(error);
  return data;
}

export async function criarEmpresa(dados: {
  nome: string;
  slug: string;
  cor_primaria?: string | null;
  cor_secundaria?: string | null;
}): Promise<Empresa> {
  const { data, error } = await supabase
    .from("estabelecimentos")
    .insert({
      nome: dados.nome.trim(),
      slug: dados.slug,
      cor_primaria: dados.cor_primaria?.trim() || null,
      cor_secundaria: dados.cor_secundaria?.trim() || null,
    })
    .select(COLUNAS)
    .single();
  if (error) falhar(error);
  return data;
}

/** Identidade da empresa: só o master altera. */
export type DadosEmpresa = {
  nome?: string;
  ativo?: boolean;
  cor_primaria?: string | null;
  cor_secundaria?: string | null;
  logo_url?: string | null;
};

/** O endereço (slug) não pode ser alterado depois de criado. Texto vazio vira "sem valor". */
export async function atualizarEmpresa(id: string, dados: DadosEmpresa): Promise<Empresa> {
  const vazioParaNulo = (v: string | null | undefined) =>
    v === undefined ? undefined : v?.trim() || null;
  const campos: Partial<Omit<DadosEmpresa, "nome">> & { nome?: string } = {};
  if (dados.nome !== undefined) campos.nome = dados.nome.trim();
  if (dados.ativo !== undefined) campos.ativo = dados.ativo;
  for (const k of ["cor_primaria", "cor_secundaria", "logo_url"] as const) {
    const v = vazioParaNulo(dados[k]);
    if (v !== undefined) campos[k] = v;
  }
  const { data, error } = await supabase
    .from("estabelecimentos")
    .update(campos)
    .eq("id", id)
    .select(COLUNAS)
    .maybeSingle();
  if (error) falhar(error);
  if (!data) throw new ErroEmpresa("nao_encontrada"); // sem linha = não existe ou sem permissão
  return data;
}

/** Textos da página pública: o administrador da empresa (ou o master) salva pela função do banco. */
export type DadosApresentacao = {
  descricao: string;
  whatsapp: string;
  instagram: string;
  endereco: string;
  horarios: Horarios | null;
  intervalo: Intervalo | null;
};

export async function atualizarApresentacao(
  empresaId: string,
  d: DadosApresentacao,
): Promise<void> {
  const { error } = await supabase.rpc("atualizar_apresentacao", {
    _empresa: empresaId,
    _descricao: d.descricao,
    _whatsapp: d.whatsapp,
    _instagram: d.instagram,
    _endereco: d.endereco,
    _horarios: d.horarios,
    _intervalo: d.intervalo,
  });
  if (error) falhar(error);
}
