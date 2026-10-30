import type { Tables } from "@/integrations/supabase/types";

/** Uma empresa cliente do SaaS (tabela `estabelecimentos`). */
export type Empresa = Pick<
  Tables<"estabelecimentos">,
  "id" | "slug" | "nome" | "ativo" | "cor_primaria" | "cor_secundaria" | "logo_url" | "criado_em"
>;

export type CodigoErroEmpresa =
  | "slug_duplicado"
  | "slug_reservado"
  | "slug_formato"
  | "nome_invalido"
  | "sem_permissao"
  | "nao_encontrada"
  | "desconhecido";

export const MENSAGENS_EMPRESA: Record<CodigoErroEmpresa, string> = {
  slug_duplicado: "Já existe uma empresa com este endereço.",
  slug_reservado: "Este endereço é reservado. Escolha outro.",
  slug_formato: "Endereço inválido. Use letras minúsculas, números, hífen e sublinhado.",
  nome_invalido: "O nome deve ter de 2 a 80 caracteres.",
  sem_permissao: "Você não tem permissão para esta ação.",
  nao_encontrada: "Empresa não encontrada.",
  desconhecido: "Não foi possível concluir a operação. Tente novamente.",
};

export class ErroEmpresa extends Error {
  constructor(public readonly codigo: CodigoErroEmpresa) {
    super(MENSAGENS_EMPRESA[codigo]);
    this.name = "ErroEmpresa";
  }
}
