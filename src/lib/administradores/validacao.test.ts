import { describe, expect, it } from "vitest";
import { esquemaNovoAdministrador, gerarSenhaProvisoria } from "./validacao";
import { REQUISITOS_SENHA } from "@/lib/auth/validacao";

describe("gerarSenhaProvisoria", () => {
  it("gera senhas fortes que sempre passam nos requisitos", () => {
    for (let i = 0; i < 200; i++) {
      const s = gerarSenhaProvisoria();
      expect(s).toHaveLength(14);
      expect(REQUISITOS_SENHA.every((r) => r.ok(s))).toBe(true);
      expect(s).not.toMatch(/[0O1lI]/); // sem caracteres ambíguos
    }
  });
  it("não repete senhas", () => {
    const set = new Set(Array.from({ length: 200 }, () => gerarSenhaProvisoria()));
    expect(set.size).toBe(200);
  });
});

describe("esquemaNovoAdministrador", () => {
  const base = { email: "a@b.co", senhaProvisoria: "Senha12345", empresaIds: [] };
  it("normaliza o e-mail e remove empresas repetidas", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const r = esquemaNovoAdministrador.safeParse({
      ...base,
      email: " A@B.CO ",
      empresaIds: [id, id],
    });
    expect(r.success && r.data).toMatchObject({ email: "a@b.co", empresaIds: [id] });
  });
  it("recusa dados inválidos", () => {
    expect(esquemaNovoAdministrador.safeParse({ ...base, email: "x" }).success).toBe(false);
    expect(esquemaNovoAdministrador.safeParse({ ...base, senhaProvisoria: "abc" }).success).toBe(
      false,
    );
    expect(esquemaNovoAdministrador.safeParse({ ...base, empresaIds: ["1"] }).success).toBe(false);
  });
});
