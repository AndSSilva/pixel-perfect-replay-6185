import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ErroPedido, codigoDoErro } from "./tipos";
import type { PedidoPainel } from "./painel";

// Operações do painel (administrador/master logado). Leitura direta (RLS) e escrita só por funções.

function falhar(
  etapa: string,
  e: { code?: string | undefined; message?: string | undefined; details?: string | undefined },
): never {
  console.error("[pedidos-painel]", etapa, { codigo: e.code, mensagem: e.message });
  throw new ErroPedido(codigoDoErro(e), e.details);
}

export const chavePedidos = (empresaId: string) => ["pedidos", empresaId] as const;
export const chaveComandas = (empresaId: string) => ["comandas", empresaId] as const;

const LIMITE_PEDIDOS = 300;

// A coluna token_hash não é legível pelo painel: sempre listar as colunas.
export const COLUNAS_COMANDA =
  "id, estabelecimento_id, sessao_id, mesa_id, mesa_numero, cliente_nome, status, aberta_em, fechada_em";

export async function listarPedidos(empresaId: string): Promise<PedidoPainel[]> {
  const { data: pedidos, error } = await supabase
    .from("pedidos")
    .select("*")
    .eq("estabelecimento_id", empresaId)
    .order("criado_em", { ascending: false })
    .limit(LIMITE_PEDIDOS);
  if (error) falhar("listarPedidos", error);
  if (pedidos.length === 0) return [];

  const ids = pedidos.map((p) => p.id);
  const comandaIds = [...new Set(pedidos.map((p) => p.comanda_id))];
  const [itens, comandas] = await Promise.all([
    supabase.from("itens_pedido").select("*").in("pedido_id", ids),
    supabase.from("comandas").select(COLUNAS_COMANDA).in("id", comandaIds),
  ]);
  if (itens.error) falhar("listarItens", itens.error);
  if (comandas.error) falhar("listarComandas", comandas.error);

  const porPedido = new Map<string, Tables<"itens_pedido">[]>();
  for (const i of itens.data) {
    const l = porPedido.get(i.pedido_id) ?? [];
    l.push(i);
    porPedido.set(i.pedido_id, l);
  }
  const nomes = new Map(comandas.data.map((c) => [c.id, c] as const));
  return pedidos.map((p) => ({
    ...p,
    cliente_nome: nomes.get(p.comanda_id)?.cliente_nome ?? "—",
    mesa_numero: nomes.get(p.comanda_id)?.mesa_numero ?? 0,
    itens: (porPedido.get(p.id) ?? []).sort((a, b) => a.nome_produto.localeCompare(b.nome_produto)),
  }));
}

export async function confirmarPedido(id: string): Promise<void> {
  const { error } = await supabase.rpc("confirmar_pedido", { _pedido: id });
  if (error) falhar("confirmarPedido", error);
}

export async function rejeitarPedido(id: string, motivo: string): Promise<void> {
  const m = motivo.trim();
  const { error } = await supabase.rpc("rejeitar_pedido", {
    _pedido: id,
    ...(m ? { _motivo: m } : {}),
  });
  if (error) falhar("rejeitarPedido", error);
}

export async function entregarPedido(id: string): Promise<number> {
  const { data, error } = await supabase.rpc("entregar_pedido", { _pedido: id });
  if (error) falhar("entregarPedido", error);
  return data;
}

export async function entregarItens(ids: string[]): Promise<number> {
  const { data, error } = await supabase.rpc("entregar_itens", { _itens: ids });
  if (error) falhar("entregarItens", error);
  return data;
}

export async function cancelarItem(id: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("cancelar_item", { _item: id, _motivo: motivo.trim() });
  if (error) falhar("cancelarItem", error);
}

export const chavePendentes = (empresaId: string) => ["pedidos", empresaId, "pendentes"] as const;

/** Pedidos pendentes que ainda não expiraram (contador do menu). */
export async function contarPendentes(empresaId: string): Promise<number> {
  const { count, error } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("estabelecimento_id", empresaId)
    .eq("status", "pendente")
    .gt("expira_em", new Date().toISOString());
  if (error) falhar("contarPendentes", error);
  return count ?? 0;
}
