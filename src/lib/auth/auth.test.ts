import { describe, expect, it } from "vitest";
import { mensagemAuth } from "./mensagens";
import { esquemaEmail, esquemaLogin, esquemaNovaSenha } from "./validacao";

describe("validação do login", () => {
  it("normaliza o e-mail e exige senha", () => {
    const r = esquemaLogin.safeParse({ email: "  Admin@Exemplo.COM ", senha: "x" });
    expect(r.success && r.data.email).toBe("admin@exemplo.com");
    expect(esquemaLogin.safeParse({ email: "admin@exemplo.com", senha: "" }).success).toBe(false);
    expect(esquemaEmail.safeParse({ email: "nao-e-email" }).success).toBe(false);
  });
});

describe("validação de nova senha", () => {
  const ok = (senha: string, confirmacao = senha) =>
    esquemaNovaSenha.safeParse({ senha, confirmacao }).success;
  it("exige 8+ caracteres, letra e número", () => {
    expect(ok("abc12")).toBe(false);
    expect(ok("somenteletras")).toBe(false);
    expect(ok("12345678")).toBe(false);
    expect(ok("senha1234")).toBe(true);
    expect(ok("Çafé2026!")).toBe(true);
  });
  it("exige confirmação igual e limite de tamanho", () => {
    expect(ok("senha1234", "senha12345")).toBe(false);
    expect(ok("a1".repeat(40))).toBe(false);
  });
});

describe("mensagens de erro", () => {
  it("as de login são genéricas e todas têm texto", () => {
    expect(mensagemAuth("credenciais_invalidas")).toBe("E-mail ou senha incorretos.");
    for (const c of [
      "muitas_tentativas",
      "link_invalido",
      "senha_fraca",
      "senha_repetida",
      "sem_permissao",
      "sem_sessao",
      "rede",
      "desconhecido",
    ] as const) {
      expect(mensagemAuth(c).length).toBeGreaterThan(5);
    }
  });
});
