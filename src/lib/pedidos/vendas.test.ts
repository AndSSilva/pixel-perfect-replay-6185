import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import type { ComandaPainel } from "./contas";
import type { PedidoPainel } from "./painel";
import {
  diaLocal,
  filtrarVendas,
  limitesDoPeriodo,
  lucroDaComanda,
  totaisDasVendas,
} from "./vendas";

const item = (o: Partial<Tables<"itens_pedido">>): Tables<"itens_pedido"> => ({
  cancelado_em: null,
  custo_unitario_centavos: 600,
  entregue_em: null,
  estabelecimento_id: "e",
  id: "i",
  motivo_cancelamento: null,
  nome_produto: "X",
  pedido_id: "p",
  preco_unitario_centavos: 1000,
  produto_id: null,
  quantidade: 2,
  status: "entregue",
  subtotal_centavos: 2000,
  ...o,
});
const pedido = (
  itens: Tables<"itens_pedido">[],
  status: PedidoPainel["status"] = "confirmado",
): PedidoPainel => ({
  comanda_id: "c",
  confirmado_em: null,
  criado_em: "",
  estabelecimento_id: "e",
  expira_em: "",
  id: "p",
  mesa_id: "m",
  motivo_rejeicao: null,
  rejeitado_em: null,
  sessao_id: "s",
  status,
  cliente_nome: "Ana",
  mesa_numero: 1,
  itens,
});
const pag = (forma: Tables<"pagamentos">["forma"], v: number): Tables<"pagamentos"> => ({
  comanda_id: "c",
  criado_em: "",
  estabelecimento_id: "e",
  forma,
  id: forma + v,
  observacao: null,
  recebido_centavos: null,
  troco_centavos: null,
  valor_centavos: v,
});
const comanda = (o: Partial<ComandaPainel>): ComandaPainel => ({
  aberta_em: "",
  cliente_nome: "Ana",
  estabelecimento_id: "e",
  fechada_em: "",
  id: "c",
  mesa_id: "m",
  mesa_numero: 1,
  sessao_id: "s",
  status: "paga",
  pedidos: [],
  pagamentos: [],
  ...o,
});

describe("vendas", () => {
  it("lucro: só entregues com custo; sem custo é contado à parte", () => {
    const c = comanda({
      pedidos: [
        pedido([
          item({}), // (1000-600)*2 = 800
          item({ custo_unitario_centavos: null }), // sem custo
          item({ status: "cancelado" }), // ignorado
        ]),
        pedido([item({})], "rejeitado"), // ignorado
      ],
    });
    expect(lucroDaComanda(c)).toEqual({ lucro: 800, semCusto: 1 });
  });
  it("totais somam consumo e lucro", () => {
    const a = comanda({ pedidos: [pedido([item({})])], pagamentos: [pag("pix", 2000)] });
    const b = comanda({ pedidos: [pedido([item({ subtotal_centavos: 500, quantidade: 1 })])] });
    expect(totaisDasVendas([a, b])).toEqual({
      contas: 2,
      vendido: 2500,
      lucro: 800 + 400,
      itensSemCusto: 0,
    });
  });
  it("filtros por cliente, mesa e forma", () => {
    const a = comanda({
      id: "a",
      cliente_nome: "Ana Souza",
      mesa_numero: 2,
      pagamentos: [pag("pix", 1)],
    });
    const b = comanda({
      id: "b",
      cliente_nome: "Bia",
      mesa_numero: 3,
      pagamentos: [pag("dinheiro", 1)],
    });
    const base = { cliente: "", mesa: "todas", forma: "todas" as const };
    expect(filtrarVendas([a, b], base)).toHaveLength(2);
    expect(filtrarVendas([a, b], { ...base, cliente: " souza " }).map((c) => c.id)).toEqual(["a"]);
    expect(filtrarVendas([a, b], { ...base, mesa: "3" }).map((c) => c.id)).toEqual(["b"]);
    expect(filtrarVendas([a, b], { ...base, forma: "pix" }).map((c) => c.id)).toEqual(["a"]);
  });
  it("limites do período incluem o último dia inteiro", () => {
    const l = limitesDoPeriodo("2026-10-01", "2026-10-31")!;
    expect(diaLocal(l.inicio)).toBe("2026-10-01");
    expect(diaLocal(l.fim)).toBe("2026-11-01");
    expect(limitesDoPeriodo("2026-10-31", "2026-10-01")).toBeNull();
    expect(limitesDoPeriodo("", "2026-10-01")).toBeNull();
  });
});
