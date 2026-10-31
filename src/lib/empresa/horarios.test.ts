import { describe, expect, it } from "vitest";
import {
  agoraNoFuso,
  agruparDias,
  formatarWhatsapp,
  horariosParaLinhas,
  horariosValidos,
  linhasParaHorarios,
  validarLinhas,
  horariosVazios,
  instagramValido,
  linkWhatsapp,
  normalizarInstagram,
  normalizarWhatsapp,
  statusAgora,
  textoDoStatus,
  type Horarios,
} from "./horarios";

// Névoa: seg/ter fechado; qua-qui 19:00–02:00; sex-dom 19:00–03:00.  índices: 0 dom ... 6 sáb
const nevoa: Horarios = [
  { abre: "19:00", fecha: "03:00" }, // dom
  null, // seg
  null, // ter
  { abre: "19:00", fecha: "02:00" }, // qua
  { abre: "19:00", fecha: "02:00" }, // qui
  { abre: "19:00", fecha: "03:00" }, // sex
  { abre: "19:00", fecha: "03:00" }, // sáb
];
// America/Sao_Paulo = UTC-3 (sem horário de verão desde 2019). 2026-10-31 é sábado.
const sp = (iso: string) => new Date(`${iso}-03:00`);

describe("status agora", () => {
  it("lê dia e hora no fuso de São Paulo", () => {
    expect(agoraNoFuso(new Date("2026-11-01T02:30:00Z"))).toEqual({ dia: 6, minuto: 23 * 60 + 30 }); // sáb 23:30
    expect(agoraNoFuso(sp("2026-10-31T00:05:00"))).toEqual({ dia: 6, minuto: 5 });
  });
  it("aberto durante o expediente", () => {
    expect(statusAgora(nevoa, sp("2026-10-31T21:00:00"))).toEqual({
      aberto: true,
      fechaAs: "03:00",
    });
  });
  it("aberto na madrugada, vindo do dia anterior", () => {
    // domingo 01:00 → ainda é o expediente de sábado, que fecha às 03:00
    expect(statusAgora(nevoa, sp("2026-11-01T01:00:00"))).toEqual({
      aberto: true,
      fechaAs: "03:00",
    });
    // segunda 02:30 → expediente de domingo (fecha 03:00)
    expect(statusAgora(nevoa, sp("2026-11-02T02:30:00"))).toEqual({
      aberto: true,
      fechaAs: "03:00",
    });
  });
  it("fechado depois do fim da madrugada e antes da abertura", () => {
    const s = statusAgora(nevoa, sp("2026-11-01T04:00:00")); // domingo 04:00
    expect(s).toEqual({ aberto: false, abreEm: { quando: "hoje", dia: 0, abre: "19:00" } });
    expect(textoDoStatus(s)).toBe("Fechado agora · abre hoje às 19:00");
  });
  it("fechado em dia sem expediente: próxima abertura", () => {
    // segunda 12:00 → próxima: quarta
    const s = statusAgora(nevoa, sp("2026-11-02T12:00:00"));
    expect(s).toEqual({ aberto: false, abreEm: { quando: "dia", dia: 3, abre: "19:00" } });
    expect(textoDoStatus(s)).toBe("Fechado agora · abre quarta às 19:00");
    // terça 12:00 → amanhã
    expect(textoDoStatus(statusAgora(nevoa, sp("2026-11-03T12:00:00")))).toBe(
      "Fechado agora · abre amanhã às 19:00",
    );
  });
  it("sábado 03:00 em ponto já fechou", () => {
    expect(statusAgora(nevoa, sp("2026-10-31T03:00:00")).aberto).toBe(false); // sáb 03:00: sexta fechou 03:00
  });
  it("expediente sem virar madrugada", () => {
    const h = horariosVazios();
    h[6] = { abre: "09:00", fecha: "18:00" };
    expect(statusAgora(h, sp("2026-10-31T17:59:00")).aberto).toBe(true);
    expect(statusAgora(h, sp("2026-10-31T18:00:00")).aberto).toBe(false);
    expect(statusAgora(h, sp("2026-10-31T08:59:00")).aberto).toBe(false);
  });
  it("sem nenhum horário: fechado sem previsão", () => {
    const s = statusAgora(horariosVazios(), sp("2026-10-31T12:00:00"));
    expect(s).toEqual({ aberto: false, abreEm: null });
    expect(textoDoStatus(s)).toBe("Fechado");
  });
  it("aberto agora mostra a hora de fechar", () => {
    expect(textoDoStatus({ aberto: true, fechaAs: "02:00" })).toBe("Aberto agora · fecha às 02:00");
  });
});

describe("agrupar dias", () => {
  it("junta dias seguidos iguais (segunda a domingo)", () => {
    const g = agruparDias(nevoa);
    expect(g.map((x) => x.rotulo)).toEqual([
      "Segunda e terça",
      "Quarta e quinta",
      "Sexta a domingo",
    ]);
    expect(g[0]?.janela).toBeNull();
    expect(g[2]?.dias).toEqual([5, 6, 0]);
  });
  it("dia isolado usa o nome do dia", () => {
    const h = horariosVazios();
    h[1] = { abre: "09:00", fecha: "20:00" };
    h[0] = null;
    expect(agruparDias(h).map((x) => x.rotulo)).toEqual(["Segunda", "Terça a domingo"]);
  });
});

describe("validação e contatos", () => {
  it("valida o formato de horários", () => {
    expect(horariosValidos(nevoa)).toBe(true);
    expect(horariosValidos(horariosVazios())).toBe(true);
    expect(horariosValidos([null])).toBe(false);
    expect(horariosValidos([...nevoa.slice(0, 6), { abre: "25:00", fecha: "01:00" }])).toBe(false);
    expect(horariosValidos([...nevoa.slice(0, 6), { abre: "10:00", fecha: "10:00" }])).toBe(false);
    expect(horariosValidos("x")).toBe(false);
  });
  it("whatsapp", () => {
    expect(normalizarWhatsapp("(51) 93500-1383")).toBe("51935001383");
    expect(formatarWhatsapp("51935001383")).toBe("(51) 93500-1383");
    expect(formatarWhatsapp("5551935001383")).toBe("(51) 93500-1383");
    expect(formatarWhatsapp("5133334444")).toBe("(51) 3333-4444");
    expect(linkWhatsapp("51935001383")).toBe("https://wa.me/5551935001383");
    expect(linkWhatsapp("5551935001383")).toBe("https://wa.me/5551935001383");
  });
  it("instagram", () => {
    expect(normalizarInstagram("@nevoa.lounge")).toBe("nevoa.lounge");
    expect(normalizarInstagram("https://www.instagram.com/nevoa.lounge/?hl=pt")).toBe(
      "nevoa.lounge",
    );
    expect(instagramValido("nevoa.lounge")).toBe(true);
    expect(instagramValido("com espaço")).toBe(false);
    expect(instagramValido("")).toBe(false);
  });
});

describe("formulário de horários", () => {
  it("vai e volta sem perder nada", () => {
    const linhas = horariosParaLinhas(nevoa);
    expect(linhas.map((l) => l.aberto)).toEqual([false, false, true, true, true, true, true]); // seg..dom
    expect(linhas[2]).toEqual({ aberto: true, abre: "19:00", fecha: "02:00" });
    expect(linhasParaHorarios(linhas)).toEqual(nevoa);
  });
  it("sem horário: tudo fechado e salva como vazio", () => {
    const linhas = horariosParaLinhas(null);
    expect(linhas.every((l) => !l.aberto)).toBe(true);
    expect(linhasParaHorarios(linhas)).toBeNull();
  });
  it("valida linhas abertas", () => {
    const linhas = horariosParaLinhas(null).map((l) => ({ ...l }));
    linhas[0] = { aberto: true, abre: "10:00", fecha: "10:00" };
    linhas[1] = { aberto: true, abre: "", fecha: "10:00" };
    linhas[2] = { aberto: false, abre: "", fecha: "" };
    expect(validarLinhas(linhas)).toEqual({
      0: "Abertura e fechamento não podem ser iguais.",
      1: "Informe os dois horários.",
    });
  });
});
