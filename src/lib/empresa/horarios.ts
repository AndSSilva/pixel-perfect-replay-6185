// Horário de funcionamento por dia. `horarios[0]` = domingo ... `[6]` = sábado (igual a Date#getDay).
// Um dia é `null` (fechado) ou { abre, fecha } em "HH:MM". Se `fecha` <= `abre`, o expediente vira a madrugada.
// Espelha docs/sql/12_apresentacao_v2.sql e 13_apresentacao_no_admin.sql.
export type JanelaDia = { abre: string; fecha: string };
export type Horarios = (JanelaDia | null)[];
/** Intervalo único, vale para todos os dias abertos (ex.: 12:00–14:00). `null` = sem intervalo. */
export type Intervalo = { inicio: string; fim: string };

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

export function intervaloValido(i: unknown): i is Intervalo {
  return (
    typeof i === "object" &&
    i !== null &&
    HORA_REGEX.test((i as Intervalo).inicio) &&
    HORA_REGEX.test((i as Intervalo).fim) &&
    (i as Intervalo).inicio !== (i as Intervalo).fim
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
  | { aberto: true; fechaAs: string; intervaloAte?: string }
  | {
      aberto: false;
      abreEm: { quando: "hoje" | "amanha" | "dia"; dia: number; abre: string } | null;
    };

/** Se está aberto e dentro do intervalo, avisa até que horas dura. */
export function statusAgora(
  horarios: Horarios,
  agora: Date,
  fuso: string = FUSO,
  intervalo: Intervalo | null = null,
): StatusAgora {
  const s = statusSemIntervalo(horarios, agora, fuso);
  if (s.aberto && intervalo) {
    const { minuto } = agoraNoFuso(agora, fuso);
    const ini = minutos(intervalo.inicio);
    const fim = minutos(intervalo.fim);
    const dentro = ini < fim ? minuto >= ini && minuto < fim : minuto >= ini || minuto < fim;
    if (dentro) return { ...s, intervaloAte: intervalo.fim };
  }
  return s;
}

function statusSemIntervalo(horarios: Horarios, agora: Date, fuso: string): StatusAgora {
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
  if (s.aberto && s.intervaloAte) return `Em intervalo · volta às ${s.intervaloAte}`;
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

export const textoDoIntervalo = (i: Intervalo | null): string =>
  i ? `Intervalo: ${i.inicio} – ${i.fim}` : "Sem intervalo";

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

// ---------- Formulário de horários: horário padrão + horários personalizados ----------
// O banco guarda 7 dias (`Horarios`); o formulário trabalha com grupos: cada grupo é "estes dias abrem
// neste horário". O padrão é o grupo principal; os personalizados cobrem os dias com horário diferente.
export type GrupoForm = { dias: number[]; abre: string; fecha: string };
export type HorarioForm = { padrao: GrupoForm; personalizado: boolean; extras: GrupoForm[] };

export const grupoVazio = (): GrupoForm => ({ dias: [], abre: "19:00", fecha: "02:00" });

export function horariosParaForm(h: Horarios | null): HorarioForm {
  const grupos: GrupoForm[] = [];
  for (const dia of ORDEM_EXIBICAO) {
    const j = h?.[dia] ?? null;
    if (!j) continue;
    const g = grupos.find((x) => x.abre === j.abre && x.fecha === j.fecha);
    if (g) g.dias.push(dia);
    else grupos.push({ dias: [dia], abre: j.abre, fecha: j.fecha });
  }
  if (grupos.length === 0) return { padrao: grupoVazio(), personalizado: false, extras: [] };
  // o grupo com mais dias é o padrão (empate: o que aparece primeiro na semana)
  let iPadrao = 0;
  grupos.forEach((g, i) => {
    if (g.dias.length > (grupos[iPadrao] as GrupoForm).dias.length) iPadrao = i;
  });
  const padrao = grupos[iPadrao] as GrupoForm;
  const extras = grupos.filter((_, i) => i !== iPadrao);
  return { padrao, personalizado: extras.length > 0, extras };
}

const gruposAtivos = (f: HorarioForm): GrupoForm[] => [
  f.padrao,
  ...(f.personalizado ? f.extras : []),
];

/** Nenhum dia marcado = sem horário cadastrado (a página não mostra o bloco). */
export function formParaHorarios(f: HorarioForm): Horarios | null {
  const h = horariosVazios();
  let algum = false;
  for (const g of gruposAtivos(f))
    for (const d of g.dias) {
      h[d] = { abre: g.abre, fecha: g.fecha };
      algum = true;
    }
  return algum ? h : null;
}

export type ErrosHorarioForm = { padrao?: string; extras: Record<number, string> };

/** Mensagens por grupo (padrão e índice do personalizado); objeto sem chaves = tudo certo. */
export function validarHorarioForm(f: HorarioForm): ErrosHorarioForm {
  const erros: ErrosHorarioForm = { extras: {} };
  const usados = new Set<number>();
  const conferir = (g: GrupoForm, extra: boolean): string | undefined => {
    if (extra && g.dias.length === 0) return "Marque ao menos um dia.";
    if (g.dias.length === 0) return undefined;
    if (!HORA_REGEX.test(g.abre) || !HORA_REGEX.test(g.fecha)) return "Informe os dois horários.";
    if (g.abre === g.fecha) return "Abertura e fechamento não podem ser iguais.";
    const repetido = g.dias.find((d) => usados.has(d));
    if (repetido !== undefined) return `${nomeDoDia(repetido)} já está em outro horário.`;
    g.dias.forEach((d) => usados.add(d));
    return undefined;
  };
  const ep = conferir(f.padrao, false);
  if (ep) erros.padrao = ep;
  if (f.personalizado)
    f.extras.forEach((g, i) => {
      const e = conferir(g, true);
      if (e) erros.extras[i] = e;
    });
  return erros;
}

export const temErrosHorario = (e: ErrosHorarioForm): boolean =>
  !!e.padrao || Object.keys(e.extras).length > 0;

// ---------- Formulário do intervalo ----------
export type IntervaloForm = { possui: boolean; inicio: string; fim: string };

export function intervaloParaForm(i: Intervalo | null): IntervaloForm {
  return i
    ? { possui: true, inicio: i.inicio, fim: i.fim }
    : { possui: false, inicio: "12:00", fim: "14:00" };
}

export const formParaIntervalo = (f: IntervaloForm): Intervalo | null =>
  f.possui ? { inicio: f.inicio, fim: f.fim } : null;

export function validarIntervalo(f: IntervaloForm): string | null {
  if (!f.possui) return null;
  if (!HORA_REGEX.test(f.inicio) || !HORA_REGEX.test(f.fim)) return "Informe os dois horários.";
  if (f.inicio === f.fim) return "Início e fim do intervalo não podem ser iguais.";
  return null;
}
