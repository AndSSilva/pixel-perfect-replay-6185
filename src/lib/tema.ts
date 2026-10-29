// Tema claro/escuro: automático pelo horário do aparelho, com escolha manual opcional.
// Regra (Manual INOV4 HUB / decisão de produto): 06:00–17:59 claro, 18:00–05:59 escuro.
export type Tema = "claro" | "escuro";
export type PreferenciaTema = Tema | "automatico";

export const CHAVE_TEMA = "mesa-digital:tema";

export function temaPorHorario(data: Date = new Date()): Tema {
  const h = data.getHours();
  return h >= 6 && h < 18 ? "claro" : "escuro";
}

export function lerPreferencia(): PreferenciaTema {
  try {
    const v = localStorage.getItem(CHAVE_TEMA);
    return v === "claro" || v === "escuro" ? v : "automatico";
  } catch {
    return "automatico";
  }
}

export function salvarPreferencia(p: PreferenciaTema) {
  try {
    if (p === "automatico") localStorage.removeItem(CHAVE_TEMA);
    else localStorage.setItem(CHAVE_TEMA, p);
  } catch {
    /* armazenamento indisponível: vale só nesta visita */
  }
}

export const resolverTema = (p: PreferenciaTema, data: Date = new Date()): Tema =>
  p === "automatico" ? temaPorHorario(data) : p;

export function aplicarTema(t: Tema) {
  const el = document.documentElement;
  el.classList.toggle("dark", t === "escuro");
  el.dataset["tema"] = t;
}

/**
 * Script inline executado antes da primeira pintura (evita "piscar" de tema).
 * Mantém a mesma regra de temaPorHorario/lerPreferencia — se mudar uma, mude a outra.
 */
export const SCRIPT_TEMA_INICIAL = `(function(){try{var p=localStorage.getItem(${JSON.stringify(CHAVE_TEMA)});var h=new Date().getHours();var t=(p==="claro"||p==="escuro")?p:((h>=6&&h<18)?"claro":"escuro");var e=document.documentElement;e.classList.toggle("dark",t==="escuro");e.dataset.tema=t;}catch(_){}})();`;
