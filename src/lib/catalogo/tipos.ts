import type { Tables } from "@/integrations/supabase/types";

export type Categoria = Tables<"categorias">;
export type Produto = Tables<"produtos">;
export type Mesa = Tables<"mesas">;
export type ComboItem = Tables<"combo_itens">;
export type ProdutoOpcao = Tables<"produto_opcoes">;

export type CodigoErroCatalogo =
  | "nome_duplicado"
  | "mesa_duplicada"
  | "categoria_com_produtos"
  | "categoria_invalida"
  | "dados_invalidos"
  | "sem_permissao"
  | "nao_encontrado"
  | "foto_falhou"
  | "estoque_insuficiente"
  | "estoque_invalido"
  | "estoque_nao_registrado"
  | "combo_invalido"
  | "componente_invalido"
  | "produto_em_combo"
  | "produto_em_combo_excluir"
  | "combo_com_estoque"
  | "produto_combo"
  | "combo_nao_registrado"
  | "opcoes_invalidas"
  | "opcao_nao_permitida"
  | "produto_em_opcao"
  | "produto_em_opcao_excluir"
  | "opcoes_com_estoque"
  | "produto_com_opcoes"
  | "produto_combo_com_opcoes"
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
  estoque_insuficiente: "A baixa é maior que o estoque atual.",
  estoque_invalido: "Ajuste de estoque inválido. Confira o tipo, a quantidade e a observação.",
  estoque_nao_registrado:
    "O produto foi salvo, mas o estoque inicial não pôde ser registrado. Use “Estoque” no cartão do produto.",
  combo_invalido:
    "Combo inválido. Escolha de 1 a 20 produtos diferentes, com quantidade de 1 a 99.",
  componente_invalido:
    "Um dos produtos vinculados não pode fazer parte do combo (não existe mais ou é outro combo).",
  produto_em_combo:
    "Este produto já faz parte de um combo, então não pode virar combo nem ter opções. Remova-o do combo antes.",
  produto_em_combo_excluir:
    "Este produto faz parte de um combo. Remova-o do combo antes de excluir.",
  combo_com_estoque:
    "Este produto ainda tem estoque. Zere o estoque (alteração de quantidade ou baixa) antes de transformá-lo em combo.",
  produto_combo: "Combo não tem estoque próprio: ele sai do estoque dos produtos vinculados.",
  combo_nao_registrado:
    "O produto foi salvo, mas os produtos vinculados (combo ou opções) não foram registrados. Abra Editar e tente de novo.",
  opcoes_invalidas:
    "Opções inválidas. Escolha de 1 a 30 produtos diferentes, sem repetir e sem o próprio produto.",
  opcao_nao_permitida:
    "Um dos produtos escolhidos como opção não pode ser usado (não existe mais, é um combo ou também tem opções).",
  produto_em_opcao:
    "Este produto é opção de outro produto, então não pode virar combo nem ter opções. Remova-o das opções antes.",
  produto_em_opcao_excluir:
    "Este produto é opção de outro produto. Remova-o das opções antes de excluir.",
  opcoes_com_estoque:
    "Este produto ainda tem estoque. Zere o estoque (alteração de quantidade ou baixa) antes de dar opções a ele.",
  produto_com_opcoes:
    "Produto com opções não tem estoque próprio: o estoque sai da opção que o cliente escolher.",
  produto_combo_com_opcoes: "Um produto não pode ser combo e ter opções ao mesmo tempo.",
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
  // Mensagens da função ajustar_estoque.
  if (msg === "estoque_insuficiente") return "estoque_insuficiente";
  if (
    [
      "tipo_invalido",
      "quantidade_invalida",
      "observacao_invalida",
      "observacao_obrigatoria",
      "saldo_inicial_ja_registrado",
      "sem_alteracao",
      "limite_excedido",
    ].includes(msg)
  )
    return "estoque_invalido";
  if (msg === "produto_nao_encontrado") return "nao_encontrado";
  if (
    msg === "combo_invalido" ||
    msg === "componente_invalido" ||
    msg === "produto_em_combo" ||
    msg === "combo_com_estoque" ||
    msg === "produto_combo" ||
    msg === "opcoes_invalidas" ||
    msg === "opcao_nao_permitida" ||
    msg === "produto_em_opcao" ||
    msg === "opcoes_com_estoque" ||
    msg === "produto_com_opcoes" ||
    msg === "produto_combo_com_opcoes"
  )
    return msg;
  if (e.code === "23505") return msg.includes("mesas_numero") ? "mesa_duplicada" : "nome_duplicado";
  if (e.code === "23503" && msg.includes("combo_itens")) return "produto_em_combo_excluir";
  if (e.code === "23503" && msg.includes("produto_opcoes")) return "produto_em_opcao_excluir";
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
