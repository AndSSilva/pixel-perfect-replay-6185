import type { Tables } from "@/integrations/supabase/types";

export type Categoria = Tables<"categorias">;
export type Produto = Tables<"produtos">;
export type Mesa = Tables<"mesas">;

export type CodigoErroCatalogo =
  | "nome_duplicado"
  | "mesa_duplicada"
  | "categoria_com_produtos"
  | "categoria_invalida"
  | "dados_invalidos"
  | "sem_permissao"
  | "nao_encontrado"
  | "foto_falhou"
  | "desconhecido";

export const MENSAGENS_CATALOGO: Record<CodigoErroCatalogo, string> = {
  nome_duplicado: "Já existe um item com este nome.",
  mesa_duplicada: "Já existe uma mesa com este número.",
  categoria_com_produtos:
    "Esta categoria ainda tem produtos. Mova-os para outra categoria antes de excluir.",
  categoria_invalida: "Selecione uma categoria válida.",
  dados_invalidos: "Dados inválidos. Confira os campos e tente novamente.",
  sem_permissao: "Você não tem permissão para esta ação (a empresa pode estar desativada).",
  nao_encontrado: "Registro não encontrado. Atualize a página.",
  foto_falhou: "Não foi possível enviar a foto. Tente novamente com outra imagem.",
  desconhecido: "Não foi possível concluir a operação. Tente novamente.",
};

export class ErroCatalogo extends Error {
  constructor(public readonly codigo: CodigoErroCatalogo) {
    super(MENSAGENS_CATALOGO[codigo]);
    this.name = "ErroCatalogo";
  }
}

/** Converte erros do Postgres/PostgREST em códigos nossos. */
export function codigoDoErroBanco(e: {
  code?: string | undefined;
  message?: string | undefined;
}): CodigoErroCatalogo {
  const msg = e.message ?? "";
  if (e.code === "23505") return msg.includes("mesas_numero") ? "mesa_duplicada" : "nome_duplicado";
  if (e.code === "23503") {
    // Apagar uma categoria que ainda tem produtos vs. apontar para uma categoria que não existe/é de outra empresa.
    return msg.startsWith("update or delete on table")
      ? "categoria_com_produtos"
      : "categoria_invalida";
  }
  if (e.code === "23514") return "dados_invalidos";
  if (e.code === "42501") return "sem_permissao";
  return "desconhecido";
}
