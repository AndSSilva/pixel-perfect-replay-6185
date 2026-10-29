// Tema claro/escuro: por padrão segue o horário do aparelho; a pessoa pode trocar manualmente.
// Regra (Manual INOV4 HUB / decisão de produto): 06:00–17:59 claro (dia), 18:00–05:59 escuro (noite).
// A troca manual vale só até a próxima virada de horário (06:00 ou 18:00); depois volta ao automático.
export type Tema = "claro" | "escuro";

export const CHAVE_TEMA = "mesa-digital:tema";

interface Troca {
  t: Tema;
  /** Instante (ms) em que a troca manual expira. */
  ate: number;
}

export function temaPorHorario(data: Date = new Date()): Tema {
  const h = data.getHours();
  return h >= 6 && h < 18 ? "claro" : "escuro";
}

/** Próxima virada automática de tema (06:00 ou 18:00) depois de `data`. */
export function proximaVirada(data: Date = new Date()): Date {
  const alvo = new Date(data);
  alvo.setMinutes(0, 0, 0);
  const h = data.getHours();
  if (h >= 6 && h < 18) alvo.setHours(18);
  else {
    if (h >= 18) alvo.setDate(alvo.getDate() + 1);
    alvo.setHours(6);
  }
  return alvo;
}

/** Troca manual ainda válida (ou null → vale o horário). */
export function lerTrocaManual(agora: Date = new Date()): Tema | null {
  try {
    const raw = localStorage.getItem(CHAVE_TEMA);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<Troca> | null;
    if (!o || (o.t !== "claro" && o.t !== "escuro") || typeof o.ate !== "number") return null;
    return agora.getTime() < o.ate ? o.t : null;
  } catch {
    return null;
  }
}

function salvarTrocaManual(t: Tema, agora: Date) {
  try {
    localStorage.setItem(
      CHAVE_TEMA,
      JSON.stringify({ t, ate: proximaVirada(agora).getTime() } satisfies Troca),
    );
  } catch {
    /* armazenamento indisponível: vale só nesta visita */
  }
}

function limparTrocaManual() {
  try {
    localStorage.removeItem(CHAVE_TEMA);
  } catch {
    /* ignora */
  }
}

/** Tema em vigor agora: troca manual válida ou, na falta dela, o horário. */
export const temaAtual = (agora: Date = new Date()): Tema =>
  lerTrocaManual(agora) ?? temaPorHorario(agora);

/**
 * Alterna para o tema oposto ao atual e devolve o novo tema.
 * Se o oposto coincide com o horário, apenas volta ao automático (apaga a troca manual).
 */
export function alternarTema(agora: Date = new Date()): Tema {
  const atual = temaAtual(agora);
  const novo: Tema = atual === "claro" ? "escuro" : "claro";
  if (novo === temaPorHorario(agora)) limparTrocaManual();
  else salvarTrocaManual(novo, agora);
  return novo;
}

export function aplicarTema(t: Tema) {
  const el = document.documentElement;
  el.classList.toggle("dark", t === "escuro");
  el.dataset["tema"] = t;
}

/**
 * Script inline executado antes da primeira pintura (evita "piscar" de tema).
 * Replica temaAtual() — se mudar a regra ou o formato salvo, mude os dois (há teste de equivalência).
 */
export const SCRIPT_TEMA_INICIAL = `(function(){try{var h=new Date().getHours();var t=(h>=6&&h<18)?"claro":"escuro";var r=localStorage.getItem(${JSON.stringify(CHAVE_TEMA)});if(r){var o=JSON.parse(r);if(o&&(o.t==="claro"||o.t==="escuro")&&typeof o.ate==="number"&&Date.now()<o.ate)t=o.t;}var e=document.documentElement;e.classList.toggle("dark",t==="escuro");e.dataset.tema=t;}catch(_){}})();`;
