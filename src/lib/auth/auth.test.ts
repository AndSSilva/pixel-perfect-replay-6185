import { describe, expect, it } from "vitest";
import { authService } from "./servico";
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

describe("serviço de autenticação sem backend", () => {
  it("nunca finge sucesso: tudo falha como não configurado", async () => {
    expect(authService.configurado).toBe(false);
    expect(await authService.obterSessao()).toBeNull();
    const r = await authService.entrar("a@b.co", "senha1234");
    expect(r).toEqual({ ok: false, codigo: "nao_configurado" });
    expect(await authService.linkRecuperacaoValido()).toBe(false);
    expect((await authService.definirNovaSenha("senha1234")).ok).toBe(false);
  });
  it("mensagens de erro de login são genéricas", () => {
    expect(mensagemAuth("credenciais_invalidas")).toBe("E-mail ou senha incorretos.");
  });
});
