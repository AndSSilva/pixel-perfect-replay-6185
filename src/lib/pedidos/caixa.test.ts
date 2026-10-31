import { describe, expect, it } from "vitest";
import { caixaAberto, situacaoDaDiferenca, validarValorCaixa, type CaixaRow } from "./caixa";

describe("caixa", () => {
  it("valida valores digitados", () => {
    expect(validarValorCaixa("50,00", { permitirZero: true })).toEqual({
      ok: true,
      centavos: 5000,
    });
    expect(validarValorCaixa("0", { permitirZero: true })).toEqual({ ok: true, centavos: 0 });
    expect(validarValorCaixa("0", { permitirZero: false }).ok).toBe(false);
    expect(validarValorCaixa("abc", { permitirZero: true }).ok).toBe(false);
    expect(validarValorCaixa("-5", { permitirZero: true }).ok).toBe(false);
    expect(validarValorCaixa("2000000,00", { permitirZero: true }).ok).toBe(false);
  });
  it("situação da diferença", () => {
    expect(situacaoDaDiferenca(0)).toBe("confere");
    expect(situacaoDaDiferenca(150)).toBe("sobra");
    expect(situacaoDaDiferenca(-1)).toBe("falta");
  });
  it("acha o caixa aberto", () => {
    const c = (status: CaixaRow["status"], id: string) => ({ status, id }) as CaixaRow;
    expect(caixaAberto([c("fechado", "a"), c("aberto", "b")])?.id).toBe("b");
    expect(caixaAberto([c("fechado", "a")])).toBeUndefined();
  });
});
