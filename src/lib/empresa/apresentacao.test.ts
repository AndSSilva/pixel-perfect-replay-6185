import { describe, expect, it } from "vitest";
import { destaquesDoTexto, textoDosDestaques, urlDoMapa, validarDestaques } from "./apresentacao";

describe("apresentação da empresa", () => {
  it("destaques: uma linha cada, sem vazias", () => {
    expect(destaquesDoTexto("🎱 Sinuca\r\n  💨 Narguile  \n\n🍻 Bebidas\n")).toEqual([
      "🎱 Sinuca",
      "💨 Narguile",
      "🍻 Bebidas",
    ]);
    expect(textoDosDestaques(["a", "b"])).toBe("a\nb");
    expect(destaquesDoTexto("   \n ")).toEqual([]);
  });
  it("valida quantidade e tamanho", () => {
    expect(validarDestaques(["a", "b"])).toBeNull();
    expect(validarDestaques(Array.from({ length: 9 }, () => "a"))).toContain("no máximo 8");
    expect(validarDestaques(["x".repeat(61)])).toContain("60");
  });
  it("link do mapa escapa o endereço", () => {
    const u = urlDoMapa("Rua Dr. Manoel 56, Porto Alegre & cia");
    expect(u).toContain("query=Rua%20Dr.%20Manoel%2056%2C%20Porto%20Alegre%20%26%20cia");
    expect(u.startsWith("https://www.google.com/maps/search/")).toBe(true);
  });
});

import { caminhoDoLogo } from "./logo";
describe("logo", () => {
  it("extrai o caminho da URL pública", () => {
    expect(
      caminhoDoLogo(
        "https://x.supabase.co/storage/v1/object/public/logos-empresas/abc/logo-1.png?t=1",
      ),
    ).toBe("abc/logo-1.png");
    expect(caminhoDoLogo("https://outro.com/a.png")).toBeNull();
    expect(caminhoDoLogo(null)).toBeNull();
  });
});
