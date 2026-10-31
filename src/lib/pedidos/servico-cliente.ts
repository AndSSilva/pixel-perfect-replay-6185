import { supabase } from "@/integrations/supabase/client";
import {
  ErroPedido,
  codigoDoErro,
  type CardapioPublico,
  type ComandaCliente,
  type LinhaPedido,
} from "./tipos";

// Funções públicas (sem login) do cliente. O banco valida tudo; aqui só traduzimos erros.

function falhar(
  etapa: string,
  e: { code?: string | undefined; message?: string | undefined; details?: string | undefined },
): never {
  console.error("[pedidos]", etapa, { codigo: e.code, mensagem: e.message });
  throw new ErroPedido(codigoDoErro(e), e.details);
}

export const chaveCardapio = (slug: string, numero: number) => ["cardapio", slug, numero] as const;
export const chaveMinhaComanda = (token: string) => ["minha-comanda", token] as const;

/** null = estabelecimento ou mesa inexistentes/inativos. */
export async function obterCardapio(slug: string, numero: number): Promise<CardapioPublico | null> {
  const { data, error } = await supabase.rpc("obter_cardapio_publico", {
    _slug: slug,
    _numero: numero,
  });
  if (error) falhar("obterCardapio", error);
  return (data as CardapioPublico | null) ?? null;
}

export async function identificarCliente(
  slug: string,
  numero: number,
  nome: string,
): Promise<{ comandaId: string; token: string }> {
  const { data, error } = await supabase.rpc("identificar_cliente", {
    _slug: slug,
    _numero: numero,
    _nome: nome,
  });
  if (error) falhar("identificarCliente", error);
  const r = data as { comanda_id: string; token: string };
  return { comandaId: r.comanda_id, token: r.token };
}

export async function enviarPedido(token: string, itens: LinhaPedido[]): Promise<string> {
  const { data, error } = await supabase.rpc("enviar_pedido", { _token: token, _itens: itens });
  if (error) falhar("enviarPedido", error);
  return data;
}

export async function cancelarMeuPedido(token: string, pedidoId: string): Promise<void> {
  const { error } = await supabase.rpc("cancelar_meu_pedido", { _token: token, _pedido: pedidoId });
  if (error) falhar("cancelarMeuPedido", error);
}

/** null = código não reconhecido (comanda inexistente). */
export async function obterMinhaComanda(token: string): Promise<ComandaCliente | null> {
  const { data, error } = await supabase.rpc("minha_comanda", { _token: token });
  if (error) falhar("minhaComanda", error);
  return (data as ComandaCliente | null) ?? null;
}
