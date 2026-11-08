import { describe, expect, it } from "vitest";
import { OPCOES_MAX, textoOpcoes, unidadesPossiveis, validarOpcoes } from "./opcoes";

describe("opções de escolha", () => {
  it("valida a lista", () => {
    expect(validarOpcoes([])).toMatch(/ao menos um/);
    expect(validarOpcoes(["a", ""])).toMatch(/todas as linhas/);
    expect(validarOpcoes(["a", "a"])).toMatch(/mais de uma vez/);
    expect(validarOpcoes(Array.from({ length: OPCOES_MAX + 1 }, (_, i) => `p${i}`))).toMatch(/até/);
    expect(validarOpcoes(["a", "b"])).toBeNull();
  });

  it("texto e unidades possíveis", () => {
    const m = new Map([
      [
        "a",
        {
          nome: "Menta",
          preco_custo_centavos: 1,
          estoque_qtd: 3,
          inativar_ao_zerar_estoque: true,
          id: "a",
        },
      ],
      [
        "b",
        {
          nome: "Uva",
          preco_custo_centavos: 1,
          estoque_qtd: 2,
          inativar_ao_zerar_estoque: true,
          id: "b",
        },
      ],
      [
        "c",
        {
          nome: "Maçã",
          preco_custo_centavos: 1,
          estoque_qtd: 1,
          inativar_ao_zerar_estoque: false,
          id: "c",
        },
      ],
    ]);
    expect(textoOpcoes(["a", "b"], m)).toBe("Menta, Uva");
    expect(unidadesPossiveis(["a", "b"], m)).toBe(5);
    expect(unidadesPossiveis(["a", "c"], m)).toBeNull();
  });
});
