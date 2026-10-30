import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ErroEmpresa, type CodigoErroEmpresa, type Empresa } from "./tipos";

const COLUNAS = "id, slug, nome, ativo, cor_primaria, cor_secundaria, logo_url, criado_em";

/** Converte erros do Postgres/PostgREST em códigos nossos. */
export function codigoDoErroEmpresa(
  e: Pick<PostgrestError, "code" | "message">,
): CodigoErroEmpresa {
  if (e.code === "23505") return "slug_duplicado";
  if (e.code === "23514") {
    if (e.message.includes("slug_reservado")) return "slug_reservado";
    if (e.message.includes("slug_formato")) return "slug_formato";
    if (e.message.includes("nome_tamanho")) return "nome_invalido";
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

/** O endereço (slug) não pode ser alterado depois de criado. */
export async function atualizarEmpresa(
  id: string,
  dados: { nome?: string; ativo?: boolean },
): Promise<Empresa> {
  const campos: { nome?: string; ativo?: boolean } = {};
  if (dados.nome !== undefined) campos.nome = dados.nome.trim();
  if (dados.ativo !== undefined) campos.ativo = dados.ativo;
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
