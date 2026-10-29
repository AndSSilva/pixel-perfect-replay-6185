import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  alternarTema,
  CHAVE_TEMA,
  lerTrocaManual,
  proximaVirada,
  SCRIPT_TEMA_INICIAL,
  temaAtual,
  temaPorHorario,
} from "./tema";

const as = (h: number, m = 0, dia = 29) => new Date(2026, 9, dia, h, m);

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

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
  it("calcula a próxima virada", () => {
    expect(proximaVirada(as(10, 15))).toEqual(as(18, 0));
    expect(proximaVirada(as(18, 0))).toEqual(as(6, 0, 30));
    expect(proximaVirada(as(23, 59))).toEqual(as(6, 0, 30));
    expect(proximaVirada(as(2, 30))).toEqual(as(6, 0));
  });
});

describe("alternância manual", () => {
  it("de dia oferece noite; clicar de novo volta ao automático", () => {
    const dia = as(10);
    expect(temaAtual(dia)).toBe("claro");
    expect(alternarTema(dia)).toBe("escuro");
    expect(temaAtual(dia)).toBe("escuro");
    expect(alternarTema(dia)).toBe("claro");
    expect(localStorage.getItem(CHAVE_TEMA)).toBeNull();
  });
  it("de noite oferece dia", () => {
    const noite = as(21);
    expect(alternarTema(noite)).toBe("claro");
    expect(temaAtual(noite)).toBe("claro");
  });
  it("a troca manual expira na próxima virada", () => {
    alternarTema(as(10)); // noite escolhida de dia, vale até 18:00
    expect(lerTrocaManual(as(17, 59))).toBe("escuro");
    expect(lerTrocaManual(as(18, 0))).toBeNull();
    expect(temaAtual(as(18, 0))).toBe("escuro"); // automático (noite)
    expect(temaAtual(as(6, 0, 30))).toBe("claro");
  });
  it("valor salvo inválido ou antigo é ignorado", () => {
    localStorage.setItem(CHAVE_TEMA, "escuro");
    expect(lerTrocaManual(as(10))).toBeNull();
    localStorage.setItem(CHAVE_TEMA, "{ quebrado");
    expect(lerTrocaManual(as(10))).toBeNull();
  });
});

describe("script inicial (anti-flash)", () => {
  const rodar = (quando: Date) => {
    vi.useFakeTimers();
    vi.setSystemTime(quando);
    document.documentElement.className = "";
    new Function(SCRIPT_TEMA_INICIAL)();
    return document.documentElement.classList.contains("dark") ? "escuro" : "claro";
  };
  it("segue o mesmo resultado de temaAtual() com e sem troca manual", () => {
    for (const h of [0, 5, 6, 12, 17, 18, 23]) {
      localStorage.clear();
      expect(rodar(as(h))).toBe(temaAtual(as(h)));
    }
    vi.useRealTimers();
    localStorage.clear();
    alternarTema(as(10));
    expect(rodar(as(10))).toBe("escuro");
    expect(rodar(as(18, 1))).toBe("escuro"); // expirou, automático noite
    expect(rodar(as(6, 0, 30))).toBe("claro");
  });
});
