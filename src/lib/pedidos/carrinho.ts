import type { LinhaPedido, ProdutoCardapio } from "./tipos";

export const MAX_POR_PRODUTO = 99;
export const MAX_LINHAS = 30;

/** Quantidade máxima que o cliente pode pedir deste produto agora. */
export function limiteDoProduto(p: Pick<ProdutoCardapio, "esgotado" | "qtd_disponivel">): number {
  if (p.esgotado) return 0;
  return Math.min(MAX_POR_PRODUTO, p.qtd_disponivel ?? MAX_POR_PRODUTO);
}

/**
 * Carrinho: chave → quantidade. A chave é o id do produto; em produto com opções de escolha é
 * "produto:opção" (cada opção escolhida é uma linha própria).
 */
export type Carrinho = Record<string, number>;

export const chaveLinha = (produtoId: string, opcaoId?: string | null): string =>
  opcaoId ? `${produtoId}:${opcaoId}` : produtoId;

export function lerChave(chave: string): { produtoId: string; opcaoId: string | null } {
  const [produtoId = "", opcaoId] = chave.split(":");
  return { produtoId, opcaoId: opcaoId ?? null };
}

export function alterarQuantidade(
  c: Carrinho,
  chave: string,
  delta: number,
  limite: number,
): Carrinho {
  const atual = c[chave] ?? 0;
  const novo = Math.max(0, Math.min(limite, atual + delta));
  const { [chave]: _removido, ...resto } = c;
  return novo === 0 ? resto : { ...resto, [chave]: novo };
}

/** Quantas unidades da opção já estão no carrinho (em linhas de produtos com opções e como produto avulso). */
function usoDaOpcao(c: Carrinho, opcaoId: string, exceto?: string): number {
  let soma = 0;
  for (const [chave, q] of Object.entries(c)) {
    if (chave === exceto) continue;
    const l = lerChave(chave);
    if (l.opcaoId === opcaoId || (l.opcaoId === null && l.produtoId === opcaoId)) soma += q;
  }
  return soma;
}

/** Máximo desta linha agora, descontando o que as outras linhas já usam da mesma opção. */
export function limiteDaLinha(
  c: Carrinho,
  chave: string,
  produtos: ReadonlyMap<string, ProdutoCardapio>,
): number {
  const { produtoId, opcaoId } = lerChave(chave);
  const p = produtos.get(produtoId);
  if (!p) return 0;
  if (opcaoId === null) return limiteDoProduto(p);
  const op = p.opcoes?.find((o) => o.id === opcaoId);
  if (!op || p.esgotado) return 0;
  const sobra =
    op.qtd_disponivel === null
      ? MAX_POR_PRODUTO
      : op.qtd_disponivel - usoDaOpcao(c, opcaoId, chave);
  return Math.max(0, Math.min(MAX_POR_PRODUTO, sobra));
}

export const linhasDoCarrinho = (c: Carrinho): LinhaPedido[] =>
  Object.entries(c).map(([chave, quantidade]) => {
    const { produtoId, opcaoId } = lerChave(chave);
    return opcaoId
      ? { produto_id: produtoId, opcao_id: opcaoId, quantidade }
      : { produto_id: produtoId, quantidade };
  });

export const totalDoCarrinho = (c: Carrinho, precos: ReadonlyMap<string, number>): number =>
  Object.entries(c).reduce(
    (soma, [chave, q]) => soma + (precos.get(lerChave(chave).produtoId) ?? 0) * q,
    0,
  );

/** Remove do carrinho o que saiu do cardápio e reduz ao que ainda está disponível. */
export function ajustarAoCardapio(
  c: Carrinho,
  produtos: ReadonlyMap<string, ProdutoCardapio>,
): Carrinho {
  const novo: Carrinho = {};
  for (const [chave, q] of Object.entries(c)) {
    const qtd = Math.min(q, limiteDaLinha(novo, chave, produtos));
    if (qtd > 0) novo[chave] = qtd;
  }
  return novo;
}
