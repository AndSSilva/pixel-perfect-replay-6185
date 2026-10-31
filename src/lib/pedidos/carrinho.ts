import type { LinhaPedido, ProdutoCardapio } from "./tipos";

export const MAX_POR_PRODUTO = 99;
export const MAX_LINHAS = 30;

/** Quantidade máxima que o cliente pode pedir deste produto agora. */
export function limiteDoProduto(p: Pick<ProdutoCardapio, "esgotado" | "qtd_disponivel">): number {
  if (p.esgotado) return 0;
  return Math.min(MAX_POR_PRODUTO, p.qtd_disponivel ?? MAX_POR_PRODUTO);
}

export type Carrinho = Record<string, number>;

export function alterarQuantidade(
  c: Carrinho,
  produtoId: string,
  delta: number,
  limite: number,
): Carrinho {
  const atual = c[produtoId] ?? 0;
  const novo = Math.max(0, Math.min(limite, atual + delta));
  const { [produtoId]: _removido, ...resto } = c;
  return novo === 0 ? resto : { ...resto, [produtoId]: novo };
}

export const linhasDoCarrinho = (c: Carrinho): LinhaPedido[] =>
  Object.entries(c).map(([produto_id, quantidade]) => ({ produto_id, quantidade }));

export const totalDoCarrinho = (c: Carrinho, precos: ReadonlyMap<string, number>): number =>
  Object.entries(c).reduce((soma, [id, q]) => soma + (precos.get(id) ?? 0) * q, 0);

/** Remove do carrinho o que saiu do cardápio e reduz ao que ainda está disponível. */
export function ajustarAoCardapio(
  c: Carrinho,
  produtos: ReadonlyMap<string, ProdutoCardapio>,
): Carrinho {
  const novo: Carrinho = {};
  for (const [id, q] of Object.entries(c)) {
    const p = produtos.get(id);
    const lim = p ? limiteDoProduto(p) : 0;
    const qtd = Math.min(q, lim);
    if (qtd > 0) novo[id] = qtd;
  }
  return novo;
}
