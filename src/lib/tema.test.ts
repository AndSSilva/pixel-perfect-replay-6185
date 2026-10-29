import { describe, expect, it } from "vitest";
import {
  CHAVE_TEMA,
  lerPreferencia,
  resolverTema,
  salvarPreferencia,
  SCRIPT_TEMA_INICIAL,
  temaPorHorario,
} from "./tema";

const as = (h: number, m = 0) => new Date(2026, 9, 29, h, m);

describe("tema automático por horário", () => {
  it("claro de 06:00 a 17:59", () => {
    expect(temaPorHorario(as(6, 0))).toBe("claro");
    expect(temaPorHorario(as(12))).toBe("claro");
    expect(temaPorHorario(as(17, 59))).toBe("claro");
  });
  it("escuro de 18:00 a 05:59", () => {
    expect(temaPorHorario(as(18, 0))).toBe("escuro");
    expect(temaPorHorario(as(23, 30))).toBe("escuro");
    expect(temaPorHorario(as(0, 0))).toBe("escuro");
    expect(temaPorHorario(as(5, 59))).toBe("escuro");
  });
  it("escolha manual vence o horário; automático usa o horário", () => {
    expect(resolverTema("escuro", as(12))).toBe("escuro");
    expect(resolverTema("claro", as(22))).toBe("claro");
    expect(resolverTema("automatico", as(22))).toBe("escuro");
  });
  it("persiste a preferência manual e volta ao automático ao limpar", () => {
    localStorage.clear();
    expect(lerPreferencia()).toBe("automatico");
    salvarPreferencia("escuro");
    expect(localStorage.getItem(CHAVE_TEMA)).toBe("escuro");
    expect(lerPreferencia()).toBe("escuro");
    salvarPreferencia("automatico");
    expect(lerPreferencia()).toBe("automatico");
  });
  it("o script inicial usa a mesma regra de horário e a mesma chave", () => {
    expect(SCRIPT_TEMA_INICIAL).toContain(CHAVE_TEMA);
    expect(SCRIPT_TEMA_INICIAL).toContain("h>=6&&h<18");
  });
});
