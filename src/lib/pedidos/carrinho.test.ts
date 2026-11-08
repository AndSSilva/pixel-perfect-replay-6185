import { describe, expect, it } from "vitest";
import {
  ajustarAoCardapio,
  alterarQuantidade,
  chaveLinha,
  lerChave,
  limiteDaLinha,
  limiteDoProduto,
  linhasDoCarrinho,
  totalDoCarrinho,
} from "./carrinho";
import type { ProdutoCardapio } from "./tipos";

const prod = (o: Partial<ProdutoCardapio>): ProdutoCardapio => ({
  id: "p",
  nome: "X",
  descricao: null,
  preco_venda_centavos: 1000,
  foto_path: null,
  esgotado: false,
  qtd_disponivel: null,
  ...o,
});

describe("carrinho", () => {
  it("limite: sem controle = 99; com controle = disponível; esgotado = 0", () => {
    expect(limiteDoProduto(prod({}))).toBe(99);
    expect(limiteDoProduto(prod({ qtd_disponivel: 4 }))).toBe(4);
    expect(limiteDoProduto(prod({ qtd_disponivel: 500 }))).toBe(99);
    expect(limiteDoProduto(prod({ esgotado: true, qtd_disponivel: 0 }))).toBe(0);
  });

  it("altera respeitando 0 e o limite, e remove a linha ao zerar", () => {
    let c = alterarQuantidade({}, "a", 1, 3);
    c = alterarQuantidade(c, "a", 5, 3);
    expect(c).toEqual({ a: 3 });
    c = alterarQuantidade(c, "a", -9, 3);
    expect(c).toEqual({});
  });

  it("linhas e total", () => {
    const c = { a: 2, b: 1 };
    expect(linhasDoCarrinho(c)).toEqual([
      { produto_id: "a", quantidade: 2 },
      { produto_id: "b", quantidade: 1 },
    ]);
    expect(
      totalDoCarrinho(
        c,
        new Map([
          ["a", 500],
          ["b", 250],
        ]),
      ),
    ).toBe(1250);
  });

  it("ajusta ao cardápio: reduz ao disponível e remove o que sumiu", () => {
    const m = new Map([
      ["a", prod({ id: "a", qtd_disponivel: 1 })],
      ["b", prod({ id: "b", esgotado: true, qtd_disponivel: 0 })],
    ]);
    expect(ajustarAoCardapio({ a: 3, b: 1, c: 2 }, m)).toEqual({ a: 1 });
  });
});

describe("carrinho com opções de escolha", () => {
  const narguile = prod({
    id: "ng",
    esgotado: false,
    qtd_disponivel: 3,
    opcoes: [
      { id: "menta", nome: "Menta", qtd_disponivel: 2 },
      { id: "uva", nome: "Uva", qtd_disponivel: null },
    ],
  });
  const mapa = new Map([["ng", narguile]]);

  it("chave: produto e opção", () => {
    expect(chaveLinha("ng")).toBe("ng");
    expect(chaveLinha("ng", "menta")).toBe("ng:menta");
    expect(lerChave("ng:menta")).toEqual({ produtoId: "ng", opcaoId: "menta" });
    expect(lerChave("ng")).toEqual({ produtoId: "ng", opcaoId: null });
  });

  it("linhas levam opcao_id e o total soma o preço do produto", () => {
    const c = { "ng:menta": 2, "ng:uva": 1 };
    expect(linhasDoCarrinho(c)).toEqual([
      { produto_id: "ng", opcao_id: "menta", quantidade: 2 },
      { produto_id: "ng", opcao_id: "uva", quantidade: 1 },
    ]);
    expect(totalDoCarrinho(c, new Map([["ng", 6000]]))).toBe(18000);
  });

  it("limite da linha: saldo da opção, descontando outras linhas da mesma opção", () => {
    expect(limiteDaLinha({}, "ng:menta", mapa)).toBe(2);
    expect(limiteDaLinha({}, "ng:uva", mapa)).toBe(99);
    expect(limiteDaLinha({}, "ng:inexistente", mapa)).toBe(0);
    const outro = new Map([...mapa, ["ng2", { ...narguile, id: "ng2" }]]);
    expect(limiteDaLinha({ "ng2:menta": 1 }, "ng:menta", outro)).toBe(1);
  });

  it("ajusta ao cardápio: reduz ao saldo e remove opção que saiu", () => {
    expect(ajustarAoCardapio({ "ng:menta": 5, "ng:uva": 2 }, mapa)).toEqual({
      "ng:menta": 2,
      "ng:uva": 2,
    });
    expect(ajustarAoCardapio({ "ng:sumiu": 1 }, mapa)).toEqual({});
  });
});
