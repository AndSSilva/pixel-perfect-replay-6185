import type { Tables } from "@/integrations/supabase/types";
import { devidoDaComanda, type ComandaPainel } from "./contas";

/**
 * Lucro de uma conta: (preço − custo) × quantidade dos itens ENTREGUES que têm custo cadastrado.
 * Itens entregues sem custo ficam de fora e são contados em `semCusto` (o lucro é parcial).
 */
export function lucroDaComanda(c: Pick<ComandaPainel, "pedidos">): {
  lucro: number;
  semCusto: number;
} {
  let lucro = 0;
  let semCusto = 0;
  for (const p of c.pedidos) {
    if (p.status !== "confirmado") continue;
    for (const i of p.itens) {
      if (i.status !== "entregue") continue;
      if (i.custo_unitario_centavos === null) semCusto += 1;
      else lucro += (i.preco_unitario_centavos - i.custo_unitario_centavos) * i.quantidade;
    }
  }
  return { lucro, semCusto };
}

export type TotaisVendas = {
  contas: number;
  vendido: number;
  lucro: number;
  itensSemCusto: number;
};

/** Venda = conta fechada. Valor vendido = consumo confirmado (o troco nunca entra). */
export function totaisDasVendas(contas: readonly ComandaPainel[]): TotaisVendas {
  const t: TotaisVendas = { contas: contas.length, vendido: 0, lucro: 0, itensSemCusto: 0 };
  for (const c of contas) {
    t.vendido += devidoDaComanda(c);
    const l = lucroDaComanda(c);
    t.lucro += l.lucro;
    t.itensSemCusto += l.semCusto;
  }
  return t;
}

export type FiltroVendas = {
  cliente: string;
  mesa: string; // "todas" ou número como texto
  forma: Tables<"pagamentos">["forma"] | "todas";
};

export function filtrarVendas(contas: readonly ComandaPainel[], f: FiltroVendas): ComandaPainel[] {
  const nome = f.cliente.trim().toLowerCase();
  return contas.filter(
    (c) =>
      (nome === "" || c.cliente_nome.toLowerCase().includes(nome)) &&
      (f.mesa === "todas" || String(c.mesa_numero) === f.mesa) &&
      (f.forma === "todas" || c.pagamentos.some((g) => g.forma === f.forma)),
  );
}

// ---------- Datas (sempre no fuso do aparelho de quem usa o painel) ----------
/** "YYYY-MM-DD" do dia local. */
export const diaLocal = (d: Date): string => d.toLocaleDateString("sv-SE");

const parteDia = (s: string): [number, number, number] | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

/** Início do dia `de` (inclusive) e início do dia seguinte a `ate` (exclusivo), em hora local. */
export function limitesDoPeriodo(de: string, ate: string): { inicio: Date; fim: Date } | null {
  const a = parteDia(de);
  const b = parteDia(ate);
  if (!a || !b) return null;
  const inicio = new Date(a[0], a[1] - 1, a[2]);
  const fim = new Date(b[0], b[1] - 1, b[2] + 1);
  return fim > inicio ? { inicio, fim } : null;
}
