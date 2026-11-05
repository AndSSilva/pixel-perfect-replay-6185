import type { Produto } from "./tipos";

// Regras do combo (produto que, ao ser entregue, baixa o estoque de outros produtos). Espelha docs/sql/15_combo.sql.
export type ComponenteCombo = { produtoId: string; quantidade: number };

export const COMBO_MAX_COMPONENTES = 20;
export const COMBO_QTD_MAX = 99;

type Base = Pick<Produto, "id" | "preco_custo_centavos" | "estoque_qtd" | "nome">;

/** Custo do combo = soma (custo × quantidade). `null` se faltar custo em algum componente (lucro parcial). */
export function custoDoCombo(
  componentes: readonly ComponenteCombo[],
  produtos: ReadonlyMap<string, Base>,
): number | null {
  if (componentes.length === 0) return null;
  let total = 0;
  for (const c of componentes) {
    const custo = produtos.get(c.produtoId)?.preco_custo_centavos;
    if (custo === null || custo === undefined) return null;
    total += custo * c.quantidade;
  }
  return total;
}

/** Quantos combos o estoque físico atual permite (só para mostrar no painel; o cardápio considera reservas). */
export function combosPossiveis(
  componentes: readonly ComponenteCombo[],
  produtos: ReadonlyMap<string, Base>,
): number | null {
  if (componentes.length === 0) return null;
  let menor = Infinity;
  for (const c of componentes) {
    const p = produtos.get(c.produtoId);
    if (!p) return 0;
    menor = Math.min(menor, Math.floor(p.estoque_qtd / c.quantidade));
  }
  return menor;
}

export function textoInclui(
  componentes: readonly ComponenteCombo[],
  produtos: ReadonlyMap<string, Base>,
): string {
  return componentes
    .map((c) => `${c.quantidade}× ${produtos.get(c.produtoId)?.nome ?? "?"}`)
    .join(", ");
}

/** Mensagem de erro do editor de combo, ou `null` se estiver certo. `quantidades` = texto digitado em cada linha. */
export function validarComponentes(
  linhas: readonly { produtoId: string; quantidade: string }[],
): string | null {
  if (linhas.length === 0) return "Vincule ao menos um produto ao combo.";
  if (linhas.length > COMBO_MAX_COMPONENTES)
    return `Um combo aceita até ${COMBO_MAX_COMPONENTES} produtos.`;
  const vistos = new Set<string>();
  for (const l of linhas) {
    if (!l.produtoId) return "Escolha o produto em todas as linhas.";
    if (vistos.has(l.produtoId)) return "O mesmo produto aparece mais de uma vez.";
    vistos.add(l.produtoId);
    const q = /^\d+$/.test(l.quantidade.trim()) ? Number(l.quantidade) : NaN;
    if (!(q >= 1 && q <= COMBO_QTD_MAX))
      return `Quantidade de 1 a ${COMBO_QTD_MAX} em cada produto.`;
  }
  return null;
}
