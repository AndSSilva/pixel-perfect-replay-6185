import { describe, expect, it } from "vitest";
import {
  caminhoMesa,
  codigoMesa,
  numeroDoCodigo,
  numerosParaCriar,
  proximoNumeroMesa,
  rotuloMesa,
  urlMesa,
} from "./mesas";

describe("mesas: número e endereço", () => {
  it("monta o código, o nome e o endereço", () => {
    expect(codigoMesa(3)).toBe("mesa_3");
    expect(rotuloMesa(3)).toBe("Mesa 03");
    expect(rotuloMesa(12)).toBe("Mesa 12");
    expect(caminhoMesa("adega_ponto_gelado", 3)).toBe("/adega_ponto_gelado/mesa_3");
    expect(urlMesa("https://app.exemplo.com", "bar", 10)).toBe(
      "https://app.exemplo.com/bar/mesa_10",
    );
  });
  it("lê o código de volta e recusa o que não é mesa", () => {
    expect(numeroDoCodigo("mesa_12")).toBe(12);
    for (const x of [
      "mesa_0",
      "mesa_",
      "mesa_01",
      "mesa_12345",
      "Mesa_1",
      "mesa-1",
      "mesa_1a",
      "",
    ]) {
      expect(numeroDoCodigo(x)).toBeNull();
    }
  });
  it("próximo número: depois do maior", () => {
    expect(proximoNumeroMesa([])).toBe(1);
    expect(proximoNumeroMesa([1, 2, 5])).toBe(6);
  });
  it("cria vários números pulando os já usados e respeitando o limite", () => {
    expect(numerosParaCriar(1, 3, [])).toEqual([1, 2, 3]);
    expect(numerosParaCriar(1, 3, [2])).toEqual([1, 3, 4]);
    expect(numerosParaCriar(9998, 5, [])).toEqual([9998, 9999]);
  });
});
