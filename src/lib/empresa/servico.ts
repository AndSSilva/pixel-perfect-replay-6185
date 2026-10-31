import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ErroEmpresa, type CodigoErroEmpresa, type Empresa } from "./tipos";

const COLUNAS =
  "id, slug, nome, ativo, cor_primaria, cor_secundaria, logo_url, criado_em, descricao, destaques, endereco, horario_funcionamento";

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

export async function criarEmpresa(dados: { nome: string; slug: string }): Promise<Empresa> {
  const { data, error } = await supabase
    .from("estabelecimentos")
    .insert({ nome: dados.nome.trim(), slug: dados.slug })
    .select(COLUNAS)
    .single();
  if (error) falhar(error);
  return data;
}

export type DadosEmpresa = {
  nome?: string;
  ativo?: boolean;
  descricao?: string | null;
  destaques?: string[];
  endereco?: string | null;
  horario_funcionamento?: string | null;
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
  if (dados.destaques !== undefined) campos.destaques = dados.destaques;
  for (const k of [
    "descricao",
    "endereco",
    "horario_funcionamento",
    "cor_primaria",
    "cor_secundaria",
    "logo_url",
  ] as const) {
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
