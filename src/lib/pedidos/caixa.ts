import type { Tables } from "@/integrations/supabase/types";
import { parseMoeda } from "@/lib/format";

export type CaixaRow = Tables<"caixas">;
export type MovimentoCaixa = Tables<"movimentos_caixa">;

/** Retorno de `resumo_caixa` (fonte única dos números, calculada no banco). */
export type ResumoCaixa = {
  caixa_id: string;
  status: CaixaRow["status"];
  abertura_centavos: number;
  dinheiro_centavos: number;
  reforcos_centavos: number;
  sangrias_centavos: number;
  esperado_centavos: number;
  total_recebido_centavos: number;
  qtd_pagamentos: number;
  por_forma: Record<Tables<"pagamentos">["forma"], number>;
};

/** Valor digitado em reais → centavos; `permitirZero` vale para abertura e contagem do fechamento. */
export function validarValorCaixa(
  texto: string,
  { permitirZero }: { permitirZero: boolean },
): { ok: true; centavos: number } | { ok: false; erro: string } {
  const v = parseMoeda(texto);
  if (v === null) return { ok: false, erro: "Informe um valor válido, como 50,00." };
  if (v === 0 && !permitirZero) return { ok: false, erro: "Informe um valor maior que zero." };
  if (v > 100_000_000) return { ok: false, erro: "Valor alto demais." };
  return { ok: true, centavos: v };
}

export type SituacaoDiferenca = "confere" | "sobra" | "falta";

/** Diferença do fechamento = contado − esperado. */
export function situacaoDaDiferenca(diferenca: number): SituacaoDiferenca {
  return diferenca === 0 ? "confere" : diferenca > 0 ? "sobra" : "falta";
}

export const ROTULO_DIFERENCA: Record<SituacaoDiferenca, string> = {
  confere: "Caixa conferido",
  sobra: "Sobra no caixa",
  falta: "Falta no caixa",
};

/** O caixa aberto da empresa (no máximo um). */
export const caixaAberto = (caixas: readonly CaixaRow[]): CaixaRow | undefined =>
  caixas.find((c) => c.status === "aberto");
