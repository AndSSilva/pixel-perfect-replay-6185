import { describe, expect, it } from "vitest";
import { empresasSelecionaveis, resolverEmpresaAtual } from "./atual";
import type { Empresa } from "./tipos";

const emp = (id: string, ativo = true): Empresa => ({
  id,
  slug: `empresa_${id}`,
  nome: `Empresa ${id}`,
  ativo,
  cor_primaria: null,
  cor_secundaria: null,
  logo_url: null,
  criado_em: "2026-10-30T00:00:00Z",
});

describe("empresas selecionáveis", () => {
  const todas = [emp("1"), emp("2", false)];
  it("master vê todas, inclusive inativas; administrador só as ativas", () => {
    expect(empresasSelecionaveis("master", todas)).toHaveLength(2);
    expect(empresasSelecionaveis("admin", todas).map((e) => e.id)).toEqual(["1"]);
  });
});

describe("resolverEmpresaAtual", () => {
  it("usa a empresa salva se ainda for válida", () => {
    expect(resolverEmpresaAtual("admin", [emp("1"), emp("2")], "2")?.id).toBe("2");
  });
  it("ignora a salva se saiu da lista ou foi desativada (admin)", () => {
    expect(resolverEmpresaAtual("admin", [emp("1"), emp("2")], "9")).toBeNull();
    expect(resolverEmpresaAtual("admin", [emp("1"), emp("2", false)], "2")?.id).toBe("1");
  });
  it("administrador com uma só empresa entra direto", () => {
    expect(resolverEmpresaAtual("admin", [emp("1")], null)?.id).toBe("1");
  });
  it("administrador com várias precisa escolher", () => {
    expect(resolverEmpresaAtual("admin", [emp("1"), emp("2")], null)).toBeNull();
  });
  it("master nunca escolhe automaticamente, mesmo com uma só empresa", () => {
    expect(resolverEmpresaAtual("master", [emp("1")], null)).toBeNull();
    expect(resolverEmpresaAtual("master", [emp("1"), emp("2", false)], "2")?.id).toBe("2");
  });
  it("sem empresas, não há atual", () => {
    expect(resolverEmpresaAtual("admin", [], null)).toBeNull();
  });
});
