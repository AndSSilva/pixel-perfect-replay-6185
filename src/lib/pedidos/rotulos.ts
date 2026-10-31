import type { Tables } from "@/integrations/supabase/types";

export const rotuloPedido = (
  status: Tables<"pedidos">["status"],
  expirado: boolean,
): { texto: string; tom: "alerta" | "sucesso" | "perigo" | "neutro" } => {
  if (status === "pendente") {
    return expirado
      ? { texto: "Expirado", tom: "perigo" }
      : { texto: "Aguardando confirmação", tom: "alerta" };
  }
  if (status === "confirmado") return { texto: "Confirmado", tom: "sucesso" };
  if (status === "rejeitado") return { texto: "Recusado", tom: "perigo" };
  return { texto: "Cancelado", tom: "neutro" };
};

export const rotuloItem: Record<Tables<"itens_pedido">["status"], string> = {
  aguardando: "Preparando",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const rotuloForma: Record<Tables<"pagamentos">["forma"], string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Débito",
  credito: "Crédito",
  outro: "Outro",
};

/** Cor segura (#rrggbb) vinda do cadastro da empresa; qualquer outra coisa vira o padrão. */
export const corSegura = (cor: string | null | undefined, padrao: string): string =>
  cor && /^#[0-9a-f]{6}$/i.test(cor) ? cor : padrao;

/** Texto preto ou branco, conforme a cor de fundo (#rrggbb), para manter a leitura. */
export function corDoTextoSobre(fundo: string): "#ffffff" | "#0f172a" {
  const n = parseInt(fundo.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luz = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return luz > 0.4 ? "#0f172a" : "#ffffff";
}
