// Horário de funcionamento por dia. `horarios[0]` = domingo ... `[6]` = sábado (igual a Date#getDay).
// Um dia é `null` (fechado) ou { abre, fecha } em "HH:MM". Se `fecha` <= `abre`, o expediente vira a madrugada.
// Espelha docs/sql/12_apresentacao_v2.sql.
export type JanelaDia = { abre: string; fecha: string };
export type Horarios = (JanelaDia | null)[];

export const FUSO = "America/Sao_Paulo";
export const HORA_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Ordem de exibição: segunda a domingo (valores = índices de `Horarios`). */
export const ORDEM_EXIBICAO = [1, 2, 3, 4, 5, 6, 0] as const;
const NOMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
export const nomeDoDia = (i: number): string => NOMES[i] ?? "";

export const horariosVazios = (): Horarios => Array.from({ length: 7 }, () => null);

const minutos = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const viraMadrugada = (j: JanelaDia): boolean => minutos(j.fecha) < minutos(j.abre);

export function horariosValidos(h: unknown): h is Horarios {
  return (
    Array.isArray(h) &&
    h.length === 7 &&
    h.every(
      (d) =>
        d === null ||
        (typeof d === "object" &&
          d !== null &&
          HORA_REGEX.test((d as JanelaDia).abre) &&
          HORA_REGEX.test((d as JanelaDia).fecha) &&
          (d as JanelaDia).abre !== (d as JanelaDia).fecha),
    )
  );
}

/** Dia da semana (0 = domingo) e minutos desde 00:00, no fuso do estabelecimento. */
export function agoraNoFuso(agora: Date, fuso: string = FUSO): { dia: number; minuto: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(agora);
  const pega = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(pega("weekday"));
  return { dia, minuto: Number(pega("hour")) * 60 + Number(pega("minute")) };
}

export type StatusAgora =
  | { aberto: true; fechaAs: string }
  | {
      aberto: false;
      abreEm: { quando: "hoje" | "amanha" | "dia"; dia: number; abre: string } | null;
    };

export function statusAgora(horarios: Horarios, agora: Date, fuso: string = FUSO): StatusAgora {
  const { dia, minuto } = agoraNoFuso(agora, fuso);
  const hoje = horarios[dia] ?? null;
  const ontem = horarios[(dia + 6) % 7] ?? null;
  // expediente de ontem que ainda não terminou (virou a madrugada)
  if (ontem && viraMadrugada(ontem) && minuto < minutos(ontem.fecha)) {
    return { aberto: true, fechaAs: ontem.fecha };
  }
  if (hoje) {
    const abre = minutos(hoje.abre);
    if (viraMadrugada(hoje)) {
      if (minuto >= abre) return { aberto: true, fechaAs: hoje.fecha };
    } else if (minuto >= abre && minuto < minutos(hoje.fecha)) {
      return { aberto: true, fechaAs: hoje.fecha };
    }
    if (minuto < abre) return { aberto: false, abreEm: { quando: "hoje", dia, abre: hoje.abre } };
  }
  for (let passo = 1; passo <= 7; passo++) {
    const d = (dia + passo) % 7;
    const j = horarios[d];
    if (j)
      return {
        aberto: false,
        abreEm: { quando: passo === 1 ? "amanha" : "dia", dia: d, abre: j.abre },
      };
  }
  return { aberto: false, abreEm: null };
}

export function textoDoStatus(s: StatusAgora): string {
  if (s.aberto) return `Aberto agora · fecha às ${s.fechaAs}`;
  if (!s.abreEm) return "Fechado";
  const { quando, dia, abre } = s.abreEm;
  const onde =
    quando === "hoje" ? "hoje" : quando === "amanha" ? "amanhã" : nomeDoDia(dia).toLowerCase();
  return `Fechado agora · abre ${onde} às ${abre}`;
}

export type GrupoHorario = { dias: number[]; janela: JanelaDia | null; rotulo: string };

const mesmaJanela = (a: JanelaDia | null, b: JanelaDia | null): boolean =>
  a === null || b === null ? a === b : a.abre === b.abre && a.fecha === b.fecha;

/** Junta dias seguidos (segunda a domingo) com o mesmo horário: "Sexta a domingo". */
export function agruparDias(horarios: Horarios): GrupoHorario[] {
  const grupos: GrupoHorario[] = [];
  for (const d of ORDEM_EXIBICAO) {
    const janela = horarios[d] ?? null;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && mesmaJanela(ultimo.janela, janela)) ultimo.dias.push(d);
    else grupos.push({ dias: [d], janela, rotulo: "" });
  }
  for (const g of grupos) {
    const primeiro = g.dias[0] as number;
    const ultimo = g.dias[g.dias.length - 1] as number;
    g.rotulo =
      g.dias.length === 1
        ? nomeDoDia(primeiro)
        : g.dias.length === 2
          ? `${nomeDoDia(primeiro)} e ${nomeDoDia(ultimo).toLowerCase()}`
          : `${nomeDoDia(primeiro)} a ${nomeDoDia(ultimo).toLowerCase()}`;
  }
  return grupos;
}

export const textoDaJanela = (j: JanelaDia | null): string =>
  j ? `${j.abre} – ${j.fecha}` : "Fechado";

// ---------- Contatos ----------
/** Só dígitos; aceita "(51) 93500-1383" e "+55 51 93500-1383". */
export function normalizarWhatsapp(entrada: string): string {
  const d = entrada.replace(/\D/g, "");
  return d;
}

export function whatsappValido(digitos: string): boolean {
  return /^[0-9]{10,13}$/.test(digitos);
}

/** "5551935001383" ou "51935001383" → "(51) 93500-1383". */
export function formatarWhatsapp(digitos: string): string {
  const d = digitos.length >= 12 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

export const linkWhatsapp = (digitos: string): string =>
  `https://wa.me/${digitos.length <= 11 ? `55${digitos}` : digitos}`;

/** "@nome", "instagram.com/nome/" ou "nome" → "nome" (vazio se não der). */
export function normalizarInstagram(entrada: string): string {
  const t = entrada.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  return (t.split(/[/?#]/)[0] ?? "").replace(/^@/, "");
}

export const instagramValido = (u: string): boolean => /^[A-Za-z0-9._]{1,30}$/.test(u);
export const linkInstagram = (u: string): string => `https://instagram.com/${u}`;

// ---------- Formulário (uma linha por dia, de segunda a domingo) ----------
export type LinhaHorario = { aberto: boolean; abre: string; fecha: string };

export const linhasPadrao = (): LinhaHorario[] =>
  ORDEM_EXIBICAO.map(() => ({ aberto: false, abre: "19:00", fecha: "02:00" }));

export function horariosParaLinhas(h: Horarios | null): LinhaHorario[] {
  return ORDEM_EXIBICAO.map((dia) => {
    const j = h?.[dia] ?? null;
    return j
      ? { aberto: true, abre: j.abre, fecha: j.fecha }
      : { aberto: false, abre: "19:00", fecha: "02:00" };
  });
}

/** Todas fechadas = sem horário cadastrado (a página não mostra o bloco). */
export function linhasParaHorarios(linhas: readonly LinhaHorario[]): Horarios | null {
  if (!linhas.some((l) => l.aberto)) return null;
  const h = horariosVazios();
  ORDEM_EXIBICAO.forEach((dia, i) => {
    const l = linhas[i];
    if (l?.aberto) h[dia] = { abre: l.abre, fecha: l.fecha };
  });
  return h;
}

/** Mensagem de erro por linha (índice) ou null se tudo certo. */
export function validarLinhas(linhas: readonly LinhaHorario[]): Record<number, string> {
  const erros: Record<number, string> = {};
  linhas.forEach((l, i) => {
    if (!l.aberto) return;
    if (!HORA_REGEX.test(l.abre) || !HORA_REGEX.test(l.fecha))
      erros[i] = "Informe os dois horários.";
    else if (l.abre === l.fecha) erros[i] = "Abertura e fechamento não podem ser iguais.";
  });
  return erros;
}
