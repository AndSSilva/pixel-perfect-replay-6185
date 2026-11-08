import type { Produto } from "./tipos";

// Regras do produto com opções de escolha (ex.: narguilé com essências). Espelha docs/sql/17_opcoes_de_escolha.sql.
export const OPCOES_MAX = 30;

type Base = Pick<Produto, "id" | "nome" | "preco_custo_centavos" | "estoque_qtd">;

/** Mensagem de erro do editor de opções, ou `null` se estiver certo. `ids` = produto de cada linha ("" = vazio). */
export function validarOpcoes(ids: readonly string[]): string | null {
  if (ids.length === 0) return "Vincule ao menos um produto como opção.";
  if (ids.length > OPCOES_MAX) return `Aceita até ${OPCOES_MAX} opções.`;
  if (ids.some((id) => !id)) return "Escolha o produto em todas as linhas.";
  if (new Set(ids).size !== ids.length) return "O mesmo produto aparece mais de uma vez.";
  return null;
}

export function textoOpcoes(ids: readonly string[], produtos: ReadonlyMap<string, Base>): string {
  return ids.map((id) => produtos.get(id)?.nome ?? "?").join(", ");
}

/** Quantas unidades o estoque físico das opções permite (só para o painel; o cardápio considera reservas). */
export function unidadesPossiveis(
  ids: readonly string[],
  produtos: ReadonlyMap<string, Pick<Produto, "estoque_qtd" | "inativar_ao_zerar_estoque">>,
): number | null {
  let total = 0;
  for (const id of ids) {
    const p = produtos.get(id);
    if (!p) continue;
    if (!p.inativar_ao_zerar_estoque) return null; // opção que não limita: sem limite no total
    total += p.estoque_qtd;
  }
  return total;
}
