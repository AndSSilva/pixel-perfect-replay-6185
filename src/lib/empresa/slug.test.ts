import { describe, expect, it } from "vitest";
import { sugerirSlug, validarSlug } from "./slug";

describe("sugerirSlug", () => {
  it("remove acentos e troca separadores por sublinhado", () => {
    expect(sugerirSlug("Adega Ponto Gelado")).toBe("adega_ponto_gelado");
    expect(sugerirSlug("  Bar do Zé — Centro!  ")).toBe("bar_do_ze_centro");
    expect(sugerirSlug("Café & Cia")).toBe("cafe_cia");
  });
  it("respeita o tamanho máximo sem terminar em sublinhado", () => {
    const s = sugerirSlug("a".repeat(30) + " " + "b".repeat(30));
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("_")).toBe(false);
  });
});

describe("validarSlug", () => {
  it("aceita endereços válidos", () => {
    for (const s of ["adega_ponto_gelado", "bar-do-ze", "abc", "loja123", "a1_b2-c3"]) {
      expect(validarSlug(s)).toBeNull();
    }
  });
  it("recusa formato inválido", () => {
    for (const s of ["ab", "_abc", "abc_", "-abc", "Abc", "com espaço", "ação", "a.b.c", "a/b"]) {
      expect(validarSlug(s)).not.toBeNull();
    }
    expect(validarSlug("a".repeat(41))).not.toBeNull();
  });
  it("recusa nomes reservados (colidem com rotas e arquivos)", () => {
    for (const s of ["admin", "master", "cardapio", "brand", "login", "api"]) {
      expect(validarSlug(s)).toMatch(/reservado/);
    }
  });
});
