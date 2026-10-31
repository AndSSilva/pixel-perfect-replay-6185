import { describe, expect, it } from "vitest";
import { numeroDaMesa } from "./mesa-url";

describe("numeroDaMesa", () => {
  it("lê mesa_N", () => {
    expect(numeroDaMesa("mesa_1")).toBe(1);
    expect(numeroDaMesa("mesa_120")).toBe(120);
  });
  it("rejeita o resto", () => {
    for (const x of ["mesa_0", "mesa_", "mesa1", "Mesa_1", "mesa_1x", "mesa_9999999", "1", ""]) {
      expect(numeroDaMesa(x)).toBeNull();
    }
  });
});
