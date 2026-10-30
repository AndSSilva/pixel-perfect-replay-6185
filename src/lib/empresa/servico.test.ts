import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { codigoDoErroEmpresa } from "./servico";

describe("codigoDoErroEmpresa", () => {
  it("mapeia erros do banco para códigos", () => {
    expect(codigoDoErroEmpresa({ code: "23505", message: "duplicate key" })).toBe("slug_duplicado");
    expect(
      codigoDoErroEmpresa({
        code: "23514",
        message: 'violates check constraint "estabelecimentos_slug_reservado"',
      }),
    ).toBe("slug_reservado");
    expect(
      codigoDoErroEmpresa({
        code: "23514",
        message: 'violates check constraint "estabelecimentos_slug_formato"',
      }),
    ).toBe("slug_formato");
    expect(
      codigoDoErroEmpresa({
        code: "23514",
        message: 'violates check constraint "estabelecimentos_nome_tamanho"',
      }),
    ).toBe("nome_invalido");
    expect(codigoDoErroEmpresa({ code: "42501", message: "row-level security" })).toBe(
      "sem_permissao",
    );
    expect(codigoDoErroEmpresa({ code: "XX000", message: "?" })).toBe("desconhecido");
  });
});
