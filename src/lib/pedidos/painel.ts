import type { Tables } from "@/integrations/supabase/types";

export type PedidoPainel = Tables<"pedidos"> & {
  cliente_nome: string;
  mesa_numero: number;
  itens: Tables<"itens_pedido">[];
};

export type GrupoPedido = "pendentes" | "andamento" | "encerrados";

/** Pendente (mesmo expirado, para o atendente rejeitar) · confirmado com item aguardando · resto. */
export function grupoDoPedido(p: Pick<PedidoPainel, "status" | "itens">): GrupoPedido {
  if (p.status === "pendente") return "pendentes";
  if (p.status === "confirmado" && p.itens.some((i) => i.status === "aguardando"))
    return "andamento";
  return "encerrados";
}

/** Minutos até expirar (arredondado para cima); 0 se já expirou. */
export function minutosParaExpirar(expiraEm: string, agora: number): number {
  const ms = new Date(expiraEm).getTime() - agora;
  return ms <= 0 ? 0 : Math.ceil(ms / 60_000);
}

export const pedidoExpirado = (expiraEm: string, agora: number): boolean =>
  new Date(expiraEm).getTime() <= agora;

/** Total do pedido sem itens cancelados. */
export const totalDoPedido = (p: Pick<PedidoPainel, "itens">): number =>
  p.itens.filter((i) => i.status !== "cancelado").reduce((s, i) => s + i.subtotal_centavos, 0);

export function agruparPedidos(
  pedidos: readonly PedidoPainel[],
): Record<GrupoPedido, PedidoPainel[]> {
  const g: Record<GrupoPedido, PedidoPainel[]> = { pendentes: [], andamento: [], encerrados: [] };
  for (const p of pedidos) g[grupoDoPedido(p)].push(p);
  // fila: o mais antigo primeiro; histórico: o mais recente primeiro
  g.pendentes.sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  g.andamento.sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  g.encerrados.sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  return g;
}
