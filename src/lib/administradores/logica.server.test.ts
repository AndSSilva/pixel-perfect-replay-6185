import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dependencias } from "./logica.server";
import {
  criarAdministrador,
  listarAdministradores,
  redefinirSenhaProvisoria,
} from "./logica.server";

type Res = { data?: unknown; error?: unknown };
type Resolver = (op: string, ctx: { dados?: unknown; filtros: [string, unknown][] }) => Res;

/** Cliente simulado do Supabase: tabelas configuráveis por operação, com registro das chamadas. */
function fake(tabelas: Record<string, Resolver>, extras: Record<string, unknown> = {}) {
  const chamadas: [string, string, unknown][] = [];
  const from = (nome: string) => {
    const ctx: { op: string; dados?: unknown; filtros: [string, unknown][] } = {
      op: "select",
      filtros: [],
    };
    const resolver = () => ({ data: null, error: null, ...(tabelas[nome]?.(ctx.op, ctx) ?? {}) });
    const b: Record<string, unknown> = {
      select: () => b,
      insert: (d: unknown) => {
        ctx.op = "insert";
        ctx.dados = d;
        chamadas.push([nome, "insert", d]);
        return b;
      },
      update: (d: unknown) => {
        ctx.op = "update";
        ctx.dados = d;
        chamadas.push([nome, "update", d]);
        return b;
      },
      eq: (c: string, v: unknown) => (ctx.filtros.push([c, v]), b),
      in: (c: string, v: unknown) => (ctx.filtros.push([c, v]), b),
      maybeSingle: () => Promise.resolve(resolver()),
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve(resolver()).then(ok, ko),
    };
    return b;
  };
  return { cliente: { from, ...extras } as never, chamadas };
}

const usuarioMaster = (master: boolean) =>
  ({ rpc: vi.fn().mockResolvedValue({ data: master, error: null }) }) as never;
const U1 = "11111111-1111-4111-8111-111111111111";
const E1 = "22222222-2222-4222-8222-222222222222";
const E2 = "33333333-3333-4333-8333-333333333333";

function auth(over: Record<string, unknown> = {}) {
  return {
    createUser: vi.fn().mockResolvedValue({ data: { user: { id: U1 } }, error: null }),
    deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
    listUsers: vi.fn().mockResolvedValue({
      data: {
        users: [
          { id: U1, email: "a@b.co", created_at: "2026-10-30T00:00:00Z", last_sign_in_at: null },
        ],
      },
      error: null,
    }),
    ...over,
  };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listarAdministradores", () => {
  it("só o master pode listar", async () => {
    const { cliente } = fake({});
    const dep: Dependencias = { usuario: usuarioMaster(false), admin: cliente };
    expect(await listarAdministradores(dep)).toEqual({ ok: false, codigo: "sem_permissao" });
  });
  it("junta perfis, e-mails e empresas", async () => {
    const { cliente } = fake(
      {
        perfis_acesso: () => ({ data: [{ user_id: U1, deve_trocar_senha: true }] }),
        estabelecimento_membros: () => ({
          data: [
            { user_id: U1, estabelecimento_id: E2 },
            { user_id: U1, estabelecimento_id: E1 },
          ],
        }),
        estabelecimentos: () => ({
          data: [
            { id: E1, nome: "Bar do Zé", slug: "bar_do_ze" },
            { id: E2, nome: "Adega", slug: "adega" },
          ],
        }),
      },
      { auth: { admin: auth() } },
    );
    const r = await listarAdministradores({ usuario: usuarioMaster(true), admin: cliente });
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) return;
    expect(r.dados).toHaveLength(1);
    expect(r.dados[0]).toMatchObject({ usuarioId: U1, email: "a@b.co", deveTrocarSenha: true });
    expect(r.dados[0]!.empresas.map((e) => e.nome)).toEqual(["Adega", "Bar do Zé"]); // ordenadas
  });
});

describe("criarAdministrador", () => {
  const entrada = { email: "  Novo@Exemplo.COM ", senhaProvisoria: "Senha12345", empresaIds: [E1] };

  it("recusa quem não é master, sem tocar no usuário", async () => {
    const a = auth();
    const { cliente } = fake({}, { auth: { admin: a } });
    expect(
      await criarAdministrador({ usuario: usuarioMaster(false), admin: cliente }, entrada),
    ).toEqual({ ok: false, codigo: "sem_permissao" });
    expect(a.createUser).not.toHaveBeenCalled();
  });
  it("valida e-mail e senha antes de criar", async () => {
    const a = auth();
    const { cliente } = fake({}, { auth: { admin: a } });
    const dep = { usuario: usuarioMaster(true), admin: cliente };
    expect(await criarAdministrador(dep, { ...entrada, email: "x" })).toEqual({
      ok: false,
      codigo: "dados_invalidos",
    });
    expect(await criarAdministrador(dep, { ...entrada, senhaProvisoria: "curta1" })).toEqual({
      ok: false,
      codigo: "senha_invalida",
    });
    expect(await criarAdministrador(dep, { ...entrada, empresaIds: ["nao-e-uuid"] })).toEqual({
      ok: false,
      codigo: "dados_invalidos",
    });
    expect(a.createUser).not.toHaveBeenCalled();
  });
  it("recusa empresa inexistente", async () => {
    const a = auth();
    const { cliente } = fake({ estabelecimentos: () => ({ data: [] }) }, { auth: { admin: a } });
    const r = await criarAdministrador({ usuario: usuarioMaster(true), admin: cliente }, entrada);
    expect(r).toEqual({ ok: false, codigo: "empresa_invalida" });
    expect(a.createUser).not.toHaveBeenCalled();
  });
  it("e-mail já usado → erro específico", async () => {
    const a = auth({
      createUser: vi
        .fn()
        .mockResolvedValue({ data: { user: null }, error: { code: "email_exists", message: "x" } }),
    });
    const { cliente } = fake(
      { estabelecimentos: () => ({ data: [{ id: E1 }] }) },
      { auth: { admin: a } },
    );
    expect(
      await criarAdministrador({ usuario: usuarioMaster(true), admin: cliente }, entrada),
    ).toEqual({ ok: false, codigo: "email_em_uso" });
  });
  it("cria o usuário confirmado, o perfil admin com troca obrigatória e os vínculos", async () => {
    const a = auth();
    const { cliente, chamadas } = fake(
      { estabelecimentos: () => ({ data: [{ id: E1 }] }) },
      { auth: { admin: a } },
    );
    const r = await criarAdministrador(
      { usuario: usuarioMaster(true), admin: cliente },
      { ...entrada, empresaIds: [E1, E1] },
    );
    expect(r).toEqual({ ok: true, dados: { usuarioId: U1 } });
    expect(a.createUser).toHaveBeenCalledWith({
      email: "novo@exemplo.com",
      password: "Senha12345",
      email_confirm: true,
    });
    expect(chamadas).toContainEqual([
      "perfis_acesso",
      "insert",
      { user_id: U1, papel: "admin", deve_trocar_senha: true },
    ]);
    expect(chamadas).toContainEqual([
      "estabelecimento_membros",
      "insert",
      [{ estabelecimento_id: E1, user_id: U1 }],
    ]); // sem duplicar
  });
  it("se o perfil falhar, desfaz removendo o usuário", async () => {
    const a = auth();
    const { cliente } = fake(
      {
        estabelecimentos: () => ({ data: [{ id: E1 }] }),
        perfis_acesso: (op) => (op === "insert" ? { error: { message: "boom" } } : {}),
      },
      { auth: { admin: a } },
    );
    expect(
      await criarAdministrador({ usuario: usuarioMaster(true), admin: cliente }, entrada),
    ).toEqual({ ok: false, codigo: "desconhecido" });
    expect(a.deleteUser).toHaveBeenCalledWith(U1);
  });
  it("se os vínculos falharem, desfaz removendo o usuário", async () => {
    const a = auth();
    const { cliente } = fake(
      {
        estabelecimentos: () => ({ data: [{ id: E1 }] }),
        estabelecimento_membros: (op) => (op === "insert" ? { error: { message: "boom" } } : {}),
      },
      { auth: { admin: a } },
    );
    expect(
      await criarAdministrador({ usuario: usuarioMaster(true), admin: cliente }, entrada),
    ).toEqual({ ok: false, codigo: "desconhecido" });
    expect(a.deleteUser).toHaveBeenCalledWith(U1);
  });
});

describe("redefinirSenhaProvisoria", () => {
  const entrada = { usuarioId: U1, senhaProvisoria: "Senha12345" };

  it("recusa quem não é master", async () => {
    const a = auth();
    const { cliente } = fake({}, { auth: { admin: a } });
    expect(
      await redefinirSenhaProvisoria({ usuario: usuarioMaster(false), admin: cliente }, entrada),
    ).toEqual({ ok: false, codigo: "sem_permissao" });
    expect(a.updateUserById).not.toHaveBeenCalled();
  });
  it("nunca altera a conta master", async () => {
    const a = auth();
    const { cliente } = fake(
      { perfis_acesso: () => ({ data: { papel: "master" } }) },
      { auth: { admin: a } },
    );
    expect(
      await redefinirSenhaProvisoria({ usuario: usuarioMaster(true), admin: cliente }, entrada),
    ).toEqual({ ok: false, codigo: "nao_e_administrador" });
    expect(a.updateUserById).not.toHaveBeenCalled();
  });
  it("usuário sem perfil → não encontrado", async () => {
    const { cliente } = fake(
      { perfis_acesso: () => ({ data: null }) },
      { auth: { admin: auth() } },
    );
    expect(
      await redefinirSenhaProvisoria({ usuario: usuarioMaster(true), admin: cliente }, entrada),
    ).toEqual({ ok: false, codigo: "usuario_nao_encontrado" });
  });
  it("reativa a troca obrigatória e troca a senha", async () => {
    const a = auth();
    const { cliente, chamadas } = fake(
      { perfis_acesso: (op) => (op === "select" ? { data: { papel: "admin" } } : {}) },
      { auth: { admin: a } },
    );
    expect(
      await redefinirSenhaProvisoria({ usuario: usuarioMaster(true), admin: cliente }, entrada),
    ).toEqual({ ok: true, dados: undefined });
    expect(chamadas.find((c) => c[0] === "perfis_acesso" && c[1] === "update")?.[2]).toMatchObject({
      deve_trocar_senha: true,
    });
    expect(a.updateUserById).toHaveBeenCalledWith(U1, { password: "Senha12345" });
  });
  it("senha recusada pelo backend → erro específico", async () => {
    const a = auth({
      updateUserById: vi
        .fn()
        .mockResolvedValue({ data: null, error: { code: "weak_password", message: "x" } }),
    });
    const { cliente } = fake(
      { perfis_acesso: (op) => (op === "select" ? { data: { papel: "admin" } } : {}) },
      { auth: { admin: a } },
    );
    expect(
      await redefinirSenhaProvisoria({ usuario: usuarioMaster(true), admin: cliente }, entrada),
    ).toEqual({ ok: false, codigo: "senha_invalida" });
  });
});
