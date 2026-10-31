import { describe, expect, it } from "vitest";
import { urlDoMapa } from "./apresentacao";
import { caminhoDoLogo } from "./logo";

describe("apresentação da empresa", () => {
  it("link do mapa escapa o endereço e junta as linhas", () => {
    const u = urlDoMapa("Life Open Mall · Salas 134/135\nViamão – RS");
    expect(u.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
    expect(decodeURIComponent(u.split("query=")[1] ?? "")).toBe(
      "Life Open Mall · Salas 134/135, Viamão – RS",
    );
    expect(urlDoMapa("A & B")).toContain("A%20%26%20B");
  });
});

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
