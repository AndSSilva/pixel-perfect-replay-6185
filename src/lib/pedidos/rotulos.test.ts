import { describe, expect, it } from "vitest";
import { corSegura, rotuloPedido } from "./rotulos";

describe("rótulos", () => {
  it("pedido pendente expirado aparece como expirado", () => {
    expect(rotuloPedido("pendente", true).texto).toBe("Expirado");
    expect(rotuloPedido("pendente", false).tom).toBe("alerta");
    expect(rotuloPedido("confirmado", false).tom).toBe("sucesso");
  });
  it("cor insegura cai no padrão", () => {
    expect(corSegura("#2563EB", "#000000")).toBe("#2563EB");
    expect(corSegura("red;background:url(x)", "#000000")).toBe("#000000");
    expect(corSegura(null, "#111111")).toBe("#111111");
  });
});
