import type { Database } from "@/integrations/supabase/types";

// Regras de estoque: o estoque físico só muda por movimentos registrados (histórico).
export type TipoMovimento = Database["public"]["Enums"]["tipo_movimento_estoque"];

/** Tipos que a pessoa pode lançar à mão (a baixa por entrega é feita pelo sistema). */
export type TipoAjuste = Exclude<TipoMovimento, "baixa_entrega">;

export const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = {
  saldo_inicial: "Saldo inicial",
  reposicao: "Reposição de estoque",
  alteracao_quantidade: "Alteração de quantidade",
  baixa_avaria: "Baixa por avaria",
  baixa_entrega: "Baixa por entrega",
};

export const AJUDA_AJUSTE: Record<
  TipoAjuste,
  { campo: string; dica: string; observacaoObrigatoria: boolean }
> = {
  saldo_inicial: {
    campo: "Saldo inicial (unidades)",
    dica: "Quantidade que existe hoje. Só pode ser lançado uma vez.",
    observacaoObrigatoria: false,
  },
  reposicao: {
    campo: "Quantidade que chegou",
    dica: "É somada ao estoque atual.",
    observacaoObrigatoria: false,
  },
  alteracao_quantidade: {
    campo: "Nova quantidade em estoque",
    dica: "Substitui o estoque atual (ex.: depois de uma contagem).",
    observacaoObrigatoria: true,
  },
  baixa_avaria: {
    campo: "Quantidade perdida",
    dica: "É subtraída do estoque atual (quebra, vencimento, perda).",
    observacaoObrigatoria: true,
  },
};

export const ESTOQUE_MAX = 1_000_000;

export interface ResultadoValidacaoAjuste {
  erro: string | null;
  /** Estoque que ficaria depois do ajuste (quando válido). */
  novoSaldo: number | null;
}

/** Validação no navegador (espelha a função do banco, que é quem decide de verdade). */
export function validarAjuste(entrada: {
  tipo: TipoAjuste;
  quantidade: string;
  observacao: string;
  estoqueAtual: number;
  temHistorico: boolean;
}): ResultadoValidacaoAjuste {
  const { tipo, estoqueAtual } = entrada;
  const texto = entrada.quantidade.trim();
  if (!/^\d+$/.test(texto)) return { erro: "Informe um número inteiro.", novoSaldo: null };
  const q = Number(texto);
  if (tipo === "saldo_inicial" && entrada.temHistorico)
    return { erro: "O saldo inicial já foi lançado. Use reposição ou alteração.", novoSaldo: null };
  if ((tipo === "reposicao" || tipo === "baixa_avaria") && q <= 0)
    return { erro: "Informe uma quantidade maior que zero.", novoSaldo: null };
  if (AJUDA_AJUSTE[tipo].observacaoObrigatoria && entrada.observacao.trim() === "")
    return { erro: "Explique o motivo no campo de observação.", novoSaldo: null };

  const novo =
    tipo === "saldo_inicial" || tipo === "alteracao_quantidade"
      ? q
      : tipo === "reposicao"
        ? estoqueAtual + q
        : estoqueAtual - q;
  if (novo < 0) return { erro: "A baixa é maior que o estoque atual.", novoSaldo: null };
  if (novo > ESTOQUE_MAX) return { erro: "Quantidade acima do limite permitido.", novoSaldo: null };
  if (novo === estoqueAtual)
    return { erro: "Nada a alterar: o estoque ficaria igual.", novoSaldo: null };
  return { erro: null, novoSaldo: novo };
}
