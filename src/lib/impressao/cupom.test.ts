import { describe, expect, it } from "vitest";
import type { ComandaPainel } from "@/lib/pedidos/contas";
import type { PedidoPainel } from "@/lib/pedidos/painel";
import { codigoDoPedido, cupomPedidoHtml, escapar, itensDaNota, notaContaHtml } from "./cupom";

const item = (id: string, nome: string, q: number, preco: number, status = "aguardando") =>
  ({
    id,
    nome_produto: nome,
    quantidade: q,
    preco_unitario_centavos: preco,
    subtotal_centavos: q * preco,
    produto_id: nome,
    status,
  }) as unknown as PedidoPainel["itens"][number];

const pedido = (id: string, itens: PedidoPainel["itens"]): PedidoPainel =>
  ({
    id,
    status: "confirmado",
    mesa_numero: 7,
    cliente_nome: "Ana <b>",
    criado_em: "2026-11-07T20:00:00Z",
    confirmado_em: "2026-11-07T20:02:00Z",
    itens,
  }) as unknown as PedidoPainel;

describe("cupom", () => {
  it("escapa HTML", () => {
    expect(escapar(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });

  it("código do pedido é o final do id, em maiúsculas", () => {
    expect(codigoDoPedido("aaaaaaaa-bbbb-cccc-dddd-eeeeee3fa9c1")).toBe("3FA9C1");
  });

  it("cupom do pedido: mesa, cliente escapado, itens, Inclui do combo e total sem cancelados", () => {
    const p = pedido("11111111-1111-1111-1111-111111abcdef", [
      item("a", "Balde", 2, 4500),
      item("b", "Petisco", 1, 2000, "cancelado"),
    ]);
    const html = cupomPedidoHtml(
      { nome: "Bar" },
      p,
      new Map([["a", [{ nome: "Cerveja", quantidade: 5 }]]]),
      80,
    );
    expect(html).toContain("PEDIDO ABCDEF");
    expect(html).toContain("Ana &lt;b&gt;");
    expect(html).toContain("2x Balde");
    expect(html).toContain("Inclui: 10x Cerveja");
    expect(html).not.toContain("Petisco");
    expect(html).toContain("@page{size:80mm auto");
  });

  it("largura 58 usa papel de 58 mm", () => {
    expect(cupomPedidoHtml({ nome: "Bar" }, pedido("x", []), new Map(), 58)).toContain(
      "size:58mm auto",
    );
  });

  it("nota soma o mesmo produto de pedidos diferentes e ignora cancelados/pendentes", () => {
    const conta = {
      pedidos: [
        pedido("p1", [item("a", "Cerveja", 2, 1000), item("c", "Gelo", 1, 500, "cancelado")]),
        pedido("p2", [item("b", "Cerveja", 3, 1000)]),
        { ...pedido("p3", [item("d", "Cerveja", 9, 1000)]), status: "pendente" } as PedidoPainel,
      ],
    };
    const itens = itensDaNota(conta, new Map());
    expect(itens).toEqual([{ nome: "Cerveja", quantidade: 5, unitario: 1000, subtotal: 5000 }]);
  });

  it("nota: total, pagamentos com troco e aviso de recibo sem valor fiscal", () => {
    const conta = {
      mesa_numero: 7,
      cliente_nome: "Ana",
      aberta_em: "2026-11-07T20:00:00Z",
      fechada_em: "2026-11-07T22:00:00Z",
      pedidos: [pedido("p1", [item("a", "Cerveja", 2, 1000)])],
      pagamentos: [
        { forma: "dinheiro", valor_centavos: 2000, recebido_centavos: 5000, troco_centavos: 3000 },
      ],
    } as unknown as ComandaPainel;
    const html = notaContaHtml({ nome: "Bar", endereco: "Rua A\nCentro" }, conta, new Map(), 80);
    expect(html).toContain("SEM VALOR FISCAL");
    expect(html).toContain("Fechada");
    expect(html).toContain("Rua A · Centro");
    expect(html).toContain("Dinheiro");
    expect(html).toContain("troco");
    expect(html).not.toContain("A PAGAR");
  });
});
