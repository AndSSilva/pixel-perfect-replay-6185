import type { Produto } from "./tipos";

type PrecoProduto = Pick<Produto, "preco_venda_centavos" | "preco_custo_centavos">;

/** Lucro por unidade em centavos (venda − custo). `null` quando o custo não foi informado. */
export function lucroCentavos(p: PrecoProduto): number | null {
  return p.preco_custo_centavos === null ? null : p.preco_venda_centavos - p.preco_custo_centavos;
}

/** Margem de lucro sobre o preço de venda, em %, com 1 casa. `null` sem custo ou com venda zerada. */
export function margemPercentual(p: PrecoProduto): number | null {
  const lucro = lucroCentavos(p);
  if (lucro === null || p.preco_venda_centavos <= 0) return null;
  return Math.round((lucro / p.preco_venda_centavos) * 1000) / 10;
}

export const formatarMargem = (m: number | null) =>
  m === null
    ? "—"
    : `${m.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
