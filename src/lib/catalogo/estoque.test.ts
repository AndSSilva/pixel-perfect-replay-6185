import { describe, expect, it } from "vitest";
import { validarAjuste } from "./estoque";

const base = { estoqueAtual: 10, temHistorico: true, observacao: "" };

describe("validarAjuste (espelha a função do banco)", () => {
  it("reposição soma ao estoque", () => {
    expect(validarAjuste({ ...base, tipo: "reposicao", quantidade: "5" })).toEqual({
      erro: null,
      novoSaldo: 15,
    });
    expect(validarAjuste({ ...base, tipo: "reposicao", quantidade: "0" }).erro).toMatch(
      /maior que zero/,
    );
  });
  it("baixa por avaria subtrai, exige motivo e não deixa negativar", () => {
    expect(validarAjuste({ ...base, tipo: "baixa_avaria", quantidade: "3" }).erro).toMatch(
      /motivo/,
    );
    expect(
      validarAjuste({ ...base, tipo: "baixa_avaria", quantidade: "3", observacao: "quebrou" }),
    ).toEqual({ erro: null, novoSaldo: 7 });
    expect(
      validarAjuste({ ...base, tipo: "baixa_avaria", quantidade: "11", observacao: "x" }).erro,
    ).toMatch(/maior que o estoque/);
    expect(
      validarAjuste({ ...base, tipo: "baixa_avaria", quantidade: "10", observacao: "x" }),
    ).toEqual({ erro: null, novoSaldo: 0 });
  });
  it("alteração de quantidade substitui, exige motivo e recusa ficar igual", () => {
    expect(validarAjuste({ ...base, tipo: "alteracao_quantidade", quantidade: "4" }).erro).toMatch(
      /motivo/,
    );
    expect(
      validarAjuste({
        ...base,
        tipo: "alteracao_quantidade",
        quantidade: "4",
        observacao: "contagem",
      }),
    ).toEqual({ erro: null, novoSaldo: 4 });
    expect(
      validarAjuste({
        ...base,
        tipo: "alteracao_quantidade",
        quantidade: "10",
        observacao: "contagem",
      }).erro,
    ).toMatch(/igual/);
    expect(
      validarAjuste({
        ...base,
        tipo: "alteracao_quantidade",
        quantidade: "0",
        observacao: "zerar",
      }),
    ).toEqual({ erro: null, novoSaldo: 0 });
  });
  it("saldo inicial só uma vez", () => {
    expect(
      validarAjuste({
        estoqueAtual: 0,
        temHistorico: false,
        observacao: "",
        tipo: "saldo_inicial",
        quantidade: "24",
      }),
    ).toEqual({ erro: null, novoSaldo: 24 });
    expect(validarAjuste({ ...base, tipo: "saldo_inicial", quantidade: "24" }).erro).toMatch(
      /já foi lançado/,
    );
  });
  it("recusa texto, negativos e acima do limite", () => {
    for (const q of ["", "abc", "-1", "1,5", "2.5"])
      expect(validarAjuste({ ...base, tipo: "reposicao", quantidade: q }).erro).toMatch(/inteiro/);
    expect(validarAjuste({ ...base, tipo: "reposicao", quantidade: "1000001" }).erro).toMatch(
      /limite/,
    );
  });
});
