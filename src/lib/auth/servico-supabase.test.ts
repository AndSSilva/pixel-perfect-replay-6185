import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  return {
    unsubscribe,
    signInWithPassword: vi.fn(),
    signOut: vi.fn(async () => ({ error: null })),
    getSession: vi.fn(),
    updateUser: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe } } })),
    maybeSingle: vi.fn(),
    rpc: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: m.signInWithPassword,
      signOut: m.signOut,
      getSession: m.getSession,
      updateUser: m.updateUser,
      resetPasswordForEmail: m.resetPasswordForEmail,
      onAuthStateChange: m.onAuthStateChange,
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: m.maybeSingle }) }) }),
    rpc: m.rpc,
  },
}));

import { codigoDoErro, criarServicoSupabase } from "./servico-supabase";

const sessao = { user: { id: "u1", email: "admin@exemplo.com" } };
const erroAuth = (code: string, status = 400, message = "erro") => ({
  code,
  status,
  message,
  name: "AuthApiError",
});

beforeEach(() => {
  vi.clearAllMocks();
  m.getSession.mockResolvedValue({ data: { session: null }, error: null });
  m.maybeSingle.mockResolvedValue({ data: null, error: null });
  m.rpc.mockResolvedValue({ error: null });
});

describe("codigoDoErro", () => {
  it("mapeia os erros do Supabase Auth", () => {
    expect(codigoDoErro(erroAuth("invalid_credentials"))).toBe("credenciais_invalidas");
    expect(codigoDoErro(erroAuth("x", 400, "Invalid login credentials"))).toBe(
      "credenciais_invalidas",
    );
    expect(codigoDoErro(erroAuth("x", 429))).toBe("muitas_tentativas");
    expect(codigoDoErro(erroAuth("over_email_send_rate_limit", 429))).toBe("muitas_tentativas");
    expect(codigoDoErro(erroAuth("weak_password"))).toBe("senha_fraca");
    expect(codigoDoErro(erroAuth("same_password"))).toBe("senha_repetida");
    expect(codigoDoErro(erroAuth("current_password_required"))).toBe("senha_atual_exigida");
    expect(codigoDoErro(erroAuth("current_password_mismatch"))).toBe("senha_atual_incorreta");
    expect(codigoDoErro(erroAuth("otp_expired"))).toBe("link_invalido");
    expect(
      codigoDoErro({ name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 }),
    ).toBe("rede");
    expect(codigoDoErro(erroAuth("qualquer_coisa", 500))).toBe("desconhecido");
  });
});

describe("entrar", () => {
  const svc = criarServicoSupabase();
  it("credenciais inválidas → mensagem genérica, sem consultar perfil", async () => {
    m.signInWithPassword.mockResolvedValue({ data: {}, error: erroAuth("invalid_credentials") });
    expect(await svc.entrar("a@b.co", "x")).toEqual({ ok: false, codigo: "credenciais_invalidas" });
    expect(m.maybeSingle).not.toHaveBeenCalled();
  });
  it("login válido sem perfil → sai e nega acesso", async () => {
    m.signInWithPassword.mockResolvedValue({ data: { session: sessao }, error: null });
    expect(await svc.entrar("a@b.co", "x")).toEqual({ ok: false, codigo: "sem_permissao" });
    expect(m.signOut).toHaveBeenCalled();
  });
  it("papel master não entra neste painel", async () => {
    m.signInWithPassword.mockResolvedValue({ data: { session: sessao }, error: null });
    m.maybeSingle.mockResolvedValue({
      data: { papel: "master", deve_trocar_senha: false },
      error: null,
    });
    expect(await svc.entrar("a@b.co", "x")).toEqual({ ok: false, codigo: "sem_permissao" });
    expect(m.signOut).toHaveBeenCalled();
  });
  it("admin com senha provisória → sessão com deveTrocarSenha", async () => {
    m.signInWithPassword.mockResolvedValue({ data: { session: sessao }, error: null });
    m.maybeSingle.mockResolvedValue({
      data: { papel: "admin", deve_trocar_senha: true },
      error: null,
    });
    expect(await svc.entrar("a@b.co", "x")).toEqual({
      ok: true,
      valor: { usuarioId: "u1", email: "admin@exemplo.com", deveTrocarSenha: true },
    });
  });
  it("falha ao ler o perfil → nega e sai (nunca libera por engano)", async () => {
    m.signInWithPassword.mockResolvedValue({ data: { session: sessao }, error: null });
    m.maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await svc.entrar("a@b.co", "x")).toEqual({ ok: false, codigo: "desconhecido" });
    expect(m.signOut).toHaveBeenCalled();
  });
});

describe("obterSessao", () => {
  const svc = criarServicoSupabase();
  it("sem sessão → null", async () => {
    expect(await svc.obterSessao()).toBeNull();
  });
  it("com sessão, mas falha ao confirmar o papel → null (fecha)", async () => {
    m.getSession.mockResolvedValue({ data: { session: sessao }, error: null });
    m.maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await svc.obterSessao()).toBeNull();
  });
  it("admin com senha já trocada → liberado", async () => {
    m.getSession.mockResolvedValue({ data: { session: sessao }, error: null });
    m.maybeSingle.mockResolvedValue({
      data: { papel: "admin", deve_trocar_senha: false },
      error: null,
    });
    expect(await svc.obterSessao()).toMatchObject({ usuarioId: "u1", deveTrocarSenha: false });
  });
});

describe("definirNovaSenha", () => {
  const svc = criarServicoSupabase();
  it("senha igual à atual → erro específico e não desliga o marcador", async () => {
    m.updateUser.mockResolvedValue({ error: erroAuth("same_password") });
    expect(await svc.definirNovaSenha("senha1234")).toEqual({
      ok: false,
      codigo: "senha_repetida",
    });
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("troca a senha e depois desliga o marcador", async () => {
    m.updateUser.mockResolvedValue({ error: null });
    expect((await svc.definirNovaSenha("senha1234")).ok).toBe(true);
    expect(m.updateUser).toHaveBeenCalledWith({ password: "senha1234" });
    expect(m.rpc).toHaveBeenCalledWith("marcar_senha_trocada");
  });
  it("primeiro acesso envia a senha atual ao backend", async () => {
    m.updateUser.mockResolvedValue({ error: null });
    expect((await svc.definirNovaSenha("senha1234", "provisoria")).ok).toBe(true);
    expect(m.updateUser).toHaveBeenCalledWith({
      password: "senha1234",
      current_password: "provisoria",
    });
  });
  it("recuperação por e-mail não envia senha atual", async () => {
    m.updateUser.mockResolvedValue({ error: null });
    await svc.definirNovaSenha("senha1234");
    expect(m.updateUser).toHaveBeenCalledWith({ password: "senha1234" });
  });
  it("senha atual errada → erro específico e o marcador não é desligado", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.updateUser.mockResolvedValue({ error: erroAuth("invalid_credentials") });
    expect(await svc.definirNovaSenha("senha1234", "errada")).toEqual({
      ok: false,
      codigo: "senha_atual_incorreta",
    });
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("backend exige a senha atual e ela não foi enviada → erro claro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.updateUser.mockResolvedValue({ error: erroAuth("current_password_required") });
    expect(await svc.definirNovaSenha("senha1234")).toEqual({
      ok: false,
      codigo: "senha_atual_exigida",
    });
  });
  it("falha ao desligar o marcador → erro específico (o usuário continuará no primeiro acesso)", async () => {
    m.updateUser.mockResolvedValue({ error: null });
    m.rpc.mockResolvedValue({ error: { message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await svc.definirNovaSenha("senha1234")).toEqual({
      ok: false,
      codigo: "falha_marcador",
    });
  });
  it("ao repetir depois de falha só no marcador, a mesma senha conclui o primeiro acesso", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.updateUser.mockResolvedValue({ error: null });
    m.rpc.mockResolvedValueOnce({ error: { message: "boom" } });
    expect((await svc.definirNovaSenha("senha1234")).ok).toBe(false);
    m.updateUser.mockResolvedValue({ error: erroAuth("same_password") });
    m.rpc.mockResolvedValue({ error: null });
    expect((await svc.definirNovaSenha("senha1234")).ok).toBe(true);
  });
  it("sessão ausente vira erro de sessão expirada", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.updateUser.mockResolvedValue({
      error: { name: "AuthSessionMissingError", message: "Auth session missing!", status: 400 },
    });
    expect(await svc.definirNovaSenha("senha1234")).toEqual({ ok: false, codigo: "sem_sessao" });
  });
});

describe("recuperação de senha", () => {
  const svc = criarServicoSupabase();
  it("pede o e-mail com o endereço de retorno", async () => {
    m.resetPasswordForEmail.mockResolvedValue({ error: null });
    expect((await svc.solicitarRecuperacao("a@b.co", "https://x/admin/redefinir-senha")).ok).toBe(
      true,
    );
    expect(m.resetPasswordForEmail).toHaveBeenCalledWith("a@b.co", {
      redirectTo: "https://x/admin/redefinir-senha",
    });
  });
  it("limite de envios → muitas tentativas", async () => {
    m.resetPasswordForEmail.mockResolvedValue({
      error: erroAuth("over_email_send_rate_limit", 429),
    });
    expect(await svc.solicitarRecuperacao("a@b.co", "u")).toEqual({
      ok: false,
      codigo: "muitas_tentativas",
    });
  });
  it("estar logado, sem ter vindo por link de recuperação, não conta como link válido", async () => {
    m.getSession.mockResolvedValue({ data: { session: sessao }, error: null });
    expect(await svc.linkRecuperacaoValido()).toBe(false);
  });
  it("link de recuperação na URL + sessão → válido", async () => {
    vi.resetModules();
    window.location.hash = "#access_token=abc&type=recovery";
    const { criarServicoSupabase: criar } = await import("./servico-supabase");
    m.getSession.mockResolvedValue({ data: { session: sessao }, error: null });
    expect(await criar().linkRecuperacaoValido()).toBe(true);
    window.location.hash = "";
  });
});
