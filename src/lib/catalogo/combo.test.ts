import { describe, expect, it } from "vitest";
import { combosPossiveis, custoDoCombo, textoInclui, validarComponentes } from "./combo";

const prod = (id: string, nome: string, custo: number | null, estoque: number) => ({
  id,
  nome,
  preco_custo_centavos: custo,
  estoque_qtd: estoque,
});
const mapa = new Map([
  ["a", prod("a", "Cerveja", 600, 12)],
  ["b", prod("b", "Petisco", null, 3)],
]);

describe("combo", () => {
  it("custo é a soma dos componentes e fica desconhecido se faltar custo", () => {
    expect(custoDoCombo([{ produtoId: "a", quantidade: 5 }], mapa)).toBe(3000);
    expect(
      custoDoCombo(
        [
          { produtoId: "a", quantidade: 1 },
          { produtoId: "b", quantidade: 2 },
        ],
        mapa,
      ),
    ).toBeNull();
    expect(custoDoCombo([], mapa)).toBeNull();
    expect(custoDoCombo([{ produtoId: "x", quantidade: 1 }], mapa)).toBeNull();
  });
  it("quantos combos o estoque permite", () => {
    expect(combosPossiveis([{ produtoId: "a", quantidade: 5 }], mapa)).toBe(2);
    expect(
      combosPossiveis(
        [
          { produtoId: "a", quantidade: 1 },
          { produtoId: "b", quantidade: 2 },
        ],
        mapa,
      ),
    ).toBe(1);
    expect(combosPossiveis([{ produtoId: "x", quantidade: 1 }], mapa)).toBe(0);
    expect(combosPossiveis([], mapa)).toBeNull();
  });
  it("texto do que inclui", () => {
    expect(textoInclui([{ produtoId: "a", quantidade: 5 }], mapa)).toBe("5× Cerveja");
  });
  it("valida as linhas do editor", () => {
    expect(validarComponentes([])).toMatch(/ao menos um/);
    expect(validarComponentes([{ produtoId: "", quantidade: "1" }])).toMatch(/Escolha o produto/);
    expect(
      validarComponentes([
        { produtoId: "a", quantidade: "1" },
        { produtoId: "a", quantidade: "2" },
      ]),
    ).toMatch(/mais de uma vez/);
    expect(validarComponentes([{ produtoId: "a", quantidade: "0" }])).toMatch(/Quantidade/);
    expect(validarComponentes([{ produtoId: "a", quantidade: "100" }])).toMatch(/Quantidade/);
    expect(validarComponentes([{ produtoId: "a", quantidade: "5,5" }])).toMatch(/Quantidade/);
    expect(validarComponentes([{ produtoId: "a", quantidade: "5" }])).toBeNull();
  });
});
