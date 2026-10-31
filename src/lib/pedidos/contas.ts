import type { Tables } from "@/integrations/supabase/types";
import { parseMoeda } from "@/lib/format";
import { pedidoExpirado, type PedidoPainel } from "./painel";

export type ComandaPainel = Tables<"comandas"> & {
  pedidos: PedidoPainel[];
  pagamentos: Tables<"pagamentos">[];
};

/** Itens que contam na conta: entregues ou aguardando, de pedidos confirmados. Cancelados saem. */
export const devidoDaComanda = (c: Pick<ComandaPainel, "pedidos">): number =>
  c.pedidos
    .filter((p) => p.status === "confirmado")
    .flatMap((p) => p.itens)
    .filter((i) => i.status !== "cancelado")
    .reduce((s, i) => s + i.subtotal_centavos, 0);

export const pagoDaComanda = (c: Pick<ComandaPainel, "pagamentos">): number =>
  c.pagamentos.reduce((s, g) => s + g.valor_centavos, 0);

export const saldoDaComanda = (c: ComandaPainel): number => devidoDaComanda(c) - pagoDaComanda(c);

/** Pedidos pendentes que ainda valem (os expirados não impedem nada). */
export const pedidosPendentesDaComanda = (c: ComandaPainel, agora: number): PedidoPainel[] =>
  c.pedidos.filter((p) => p.status === "pendente" && !pedidoExpirado(p.expira_em, agora));

export const itensAguardandoDaComanda = (c: ComandaPainel): number =>
  c.pedidos
    .filter((p) => p.status === "confirmado")
    .flatMap((p) => p.itens)
    .filter((i) => i.status === "aguardando").length;

export type ImpedimentoFechar = "pedidos_pendentes" | "itens_nao_entregues" | "saldo_em_aberto";

/** Mesmas regras de `fechar_comanda` no banco (o banco sempre confirma de novo). */
export function impedimentoParaFechar(c: ComandaPainel, agora: number): ImpedimentoFechar | null {
  if (pedidosPendentesDaComanda(c, agora).length > 0) return "pedidos_pendentes";
  if (itensAguardandoDaComanda(c) > 0) return "itens_nao_entregues";
  if (saldoDaComanda(c) !== 0) return "saldo_em_aberto";
  return null;
}

export const ROTULO_IMPEDIMENTO: Record<ImpedimentoFechar, string> = {
  pedidos_pendentes: "Há pedidos pendentes. Confirme ou rejeite antes.",
  itens_nao_entregues: "Há itens aguardando entrega. Entregue ou cancele antes.",
  saldo_em_aberto: "A conta ainda tem saldo em aberto.",
};

// ---------- Mesa ----------
export type SituacaoMesa = "livre" | "ocupada" | "fechamento" | "inativa";

export function situacaoDaMesa(
  mesa: Pick<Tables<"mesas">, "ativa">,
  sessao: Pick<Tables<"sessoes_mesa">, "status"> | undefined,
): SituacaoMesa {
  if (sessao && sessao.status !== "encerrada") {
    return sessao.status === "fechamento" ? "fechamento" : "ocupada";
  }
  return mesa.ativa ? "livre" : "inativa";
}

export type ImpedimentoLiberar = "pedidos_pendentes" | "itens_nao_entregues" | "comandas_em_aberto";

export function impedimentoParaLiberar(
  comandas: readonly ComandaPainel[],
  agora: number,
): ImpedimentoLiberar | null {
  if (comandas.some((c) => pedidosPendentesDaComanda(c, agora).length > 0))
    return "pedidos_pendentes";
  if (comandas.some((c) => itensAguardandoDaComanda(c) > 0)) return "itens_nao_entregues";
  if (comandas.some((c) => c.status === "aberta")) return "comandas_em_aberto";
  return null;
}

// ---------- Formulário de pagamento ----------
export type EntradaPagamento = {
  valor: string;
  forma: Tables<"pagamentos">["forma"];
  recebido: string;
  obs: string;
};
export type ErrosPagamento = Partial<Record<"valor" | "recebido" | "obs", string>>;

export type PagamentoValidado =
  | { ok: true; valor: number; recebido: number | undefined; troco: number }
  | { ok: false; erros: ErrosPagamento };

export function validarPagamento(
  e: EntradaPagamento,
  saldo: number,
  formatar: (c: number) => string,
): PagamentoValidado {
  const erros: ErrosPagamento = {};
  const valor = parseMoeda(e.valor);
  if (valor === null || valor <= 0) erros.valor = "Informe um valor maior que zero.";
  else if (valor > saldo) erros.valor = `O valor não pode passar do saldo (${formatar(saldo)}).`;
  let recebido: number | undefined;
  if (e.forma === "dinheiro" && e.recebido.trim()) {
    const r = parseMoeda(e.recebido);
    if (r === null) erros.recebido = "Valor inválido.";
    else if (valor !== null && r < valor)
      erros.recebido = "O valor recebido é menor que o pagamento.";
    else recebido = r;
  }
  if (e.obs.trim().length > 200) erros.obs = "A observação deve ter até 200 caracteres.";
  if (Object.keys(erros).length > 0 || valor === null) return { ok: false, erros };
  return { ok: true, valor, recebido, troco: recebido !== undefined ? recebido - valor : 0 };
}
