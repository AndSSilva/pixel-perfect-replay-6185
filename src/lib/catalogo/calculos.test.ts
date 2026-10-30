import { describe, expect, it } from "vitest";
import { formatarMargem, lucroCentavos, margemPercentual } from "./calculos";

const p = (venda: number, custo: number | null) => ({
  preco_venda_centavos: venda,
  preco_custo_centavos: custo,
});

describe("lucro e margem", () => {
  it("lucro = venda − custo", () => {
    expect(lucroCentavos(p(1200, 700))).toBe(500);
    expect(lucroCentavos(p(1000, 1000))).toBe(0);
    expect(lucroCentavos(p(800, 1000))).toBe(-200); // prejuízo aparece como negativo
  });
  it("sem custo, não inventa lucro", () => {
    expect(lucroCentavos(p(1200, null))).toBeNull();
    expect(margemPercentual(p(1200, null))).toBeNull();
    expect(formatarMargem(null)).toBe("—");
  });
  it("margem sobre o preço de venda, com 1 casa", () => {
    expect(margemPercentual(p(1000, 600))).toBe(40);
    expect(margemPercentual(p(1200, 700))).toBe(41.7);
    expect(margemPercentual(p(800, 1000))).toBe(-25);
    expect(formatarMargem(41.7)).toBe("41,7%");
  });
  it("venda zerada não divide por zero", () => {
    expect(margemPercentual(p(0, 0))).toBeNull();
  });
});
