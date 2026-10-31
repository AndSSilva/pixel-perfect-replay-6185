import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import {
  agruparPedidos,
  grupoDoPedido,
  minutosParaExpirar,
  totalDoPedido,
  type PedidoPainel,
} from "./painel";

const item = (o: Partial<Tables<"itens_pedido">>): Tables<"itens_pedido"> => ({
  cancelado_em: null,
  custo_unitario_centavos: null,
  entregue_em: null,
  estabelecimento_id: "e",
  id: "i",
  motivo_cancelamento: null,
  nome_produto: "X",
  pedido_id: "p",
  preco_unitario_centavos: 100,
  produto_id: null,
  quantidade: 1,
  status: "aguardando",
  subtotal_centavos: 100,
  ...o,
});
const pedido = (o: Partial<PedidoPainel>): PedidoPainel => ({
  comanda_id: "c",
  confirmado_em: null,
  criado_em: "2026-10-30T10:00:00Z",
  estabelecimento_id: "e",
  expira_em: "2026-10-30T10:45:00Z",
  id: "p",
  mesa_id: "m",
  motivo_rejeicao: null,
  rejeitado_em: null,
  sessao_id: "s",
  status: "pendente",
  cliente_nome: "Ana",
  mesa_numero: 1,
  itens: [item({})],
  ...o,
});

describe("painel de pedidos", () => {
  it("agrupa por situação", () => {
    expect(grupoDoPedido(pedido({}))).toBe("pendentes");
    expect(grupoDoPedido(pedido({ status: "confirmado" }))).toBe("andamento");
    expect(
      grupoDoPedido(
        pedido({
          status: "confirmado",
          itens: [item({ status: "entregue" }), item({ status: "cancelado" })],
        }),
      ),
    ).toBe("encerrados");
    expect(grupoDoPedido(pedido({ status: "rejeitado" }))).toBe("encerrados");
  });
  it("ordena fila (antigo primeiro) e histórico (recente primeiro)", () => {
    const g = agruparPedidos([
      pedido({ id: "b", criado_em: "2026-10-30T11:00:00Z" }),
      pedido({ id: "a", criado_em: "2026-10-30T10:00:00Z" }),
      pedido({ id: "x", status: "rejeitado", criado_em: "2026-10-30T09:00:00Z" }),
      pedido({ id: "y", status: "rejeitado", criado_em: "2026-10-30T12:00:00Z" }),
    ]);
    expect(g.pendentes.map((p) => p.id)).toEqual(["a", "b"]);
    expect(g.encerrados.map((p) => p.id)).toEqual(["y", "x"]);
  });
  it("minutos para expirar", () => {
    const agora = new Date("2026-10-30T10:30:30Z").getTime();
    expect(minutosParaExpirar("2026-10-30T10:45:00Z", agora)).toBe(15);
    expect(minutosParaExpirar("2026-10-30T10:30:00Z", agora)).toBe(0);
  });
  it("total ignora itens cancelados", () => {
    expect(
      totalDoPedido(
        pedido({
          itens: [
            item({ subtotal_centavos: 300 }),
            item({ subtotal_centavos: 500, status: "cancelado" }),
          ],
        }),
      ),
    ).toBe(300);
  });
});
