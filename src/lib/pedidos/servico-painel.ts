import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ErroPedido, codigoDoErro } from "./tipos";
import type { ComandaPainel } from "./contas";
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

// ---------- Contas (comandas), pagamentos e mesas ----------

export const chaveSessoes = (empresaId: string) => ["sessoes", empresaId] as const;

/** Depois de qualquer ação de atendimento: refaz pedidos, contas, mesas e estoque. */
export function atualizarAtendimento(qc: QueryClient, empresaId: string): void {
  for (const chave of [
    chavePedidos(empresaId),
    chaveComandas(empresaId),
    chaveSessoes(empresaId),
    ["produtos", empresaId],
  ]) {
    void qc.invalidateQueries({ queryKey: chave });
  }
}

/** Sessões em andamento (mesas ocupadas ou em fechamento). */
export async function listarSessoesAtivas(empresaId: string): Promise<Tables<"sessoes_mesa">[]> {
  const { data, error } = await supabase
    .from("sessoes_mesa")
    .select("*")
    .eq("estabelecimento_id", empresaId)
    .neq("status", "encerrada");
  if (error) falhar("listarSessoes", error);
  return data;
}

async function montarComandas(
  empresaId: string,
  comandas: Tables<"comandas">[],
): Promise<ComandaPainel[]> {
  if (comandas.length === 0) return [];
  const ids = comandas.map((c) => c.id);
  const [pedidos, pagamentos] = await Promise.all([
    supabase.from("pedidos").select("*").eq("estabelecimento_id", empresaId).in("comanda_id", ids),
    supabase
      .from("pagamentos")
      .select("*")
      .eq("estabelecimento_id", empresaId)
      .in("comanda_id", ids),
  ]);
  if (pedidos.error) falhar("comandas/pedidos", pedidos.error);
  if (pagamentos.error) falhar("comandas/pagamentos", pagamentos.error);
  const itens =
    pedidos.data.length === 0
      ? { data: [] as Tables<"itens_pedido">[], error: null }
      : await supabase
          .from("itens_pedido")
          .select("*")
          .eq("estabelecimento_id", empresaId)
          .in(
            "pedido_id",
            pedidos.data.map((p) => p.id),
          );
  if (itens.error) falhar("comandas/itens", itens.error);

  return comandas.map((c) => ({
    ...c,
    pagamentos: pagamentos.data
      .filter((g) => g.comanda_id === c.id)
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
    pedidos: pedidos.data
      .filter((p) => p.comanda_id === c.id)
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
      .map((p) => ({
        ...p,
        cliente_nome: c.cliente_nome,
        mesa_numero: c.mesa_numero,
        itens: itens.data
          .filter((i) => i.pedido_id === p.id)
          .sort((a, b) => a.nome_produto.localeCompare(b.nome_produto)),
      })),
  }));
}

/** Comandas das mesas em atendimento (abertas, ou já pagas aguardando a liberação da mesa). */
export async function listarComandasAtivas(empresaId: string): Promise<ComandaPainel[]> {
  const sessoes = await listarSessoesAtivas(empresaId);
  if (sessoes.length === 0) return [];
  const { data, error } = await supabase
    .from("comandas")
    .select(COLUNAS_COMANDA)
    .eq("estabelecimento_id", empresaId)
    .in(
      "sessao_id",
      sessoes.map((s) => s.id),
    )
    .order("aberta_em");
  if (error) falhar("listarComandasAtivas", error);
  return montarComandas(empresaId, data);
}

/** null = não existe (ou não é desta empresa). */
export async function obterComanda(empresaId: string, id: string): Promise<ComandaPainel | null> {
  const { data, error } = await supabase
    .from("comandas")
    .select(COLUNAS_COMANDA)
    .eq("estabelecimento_id", empresaId)
    .eq("id", id)
    .maybeSingle();
  if (error) falhar("obterComanda", error);
  if (!data) return null;
  return (await montarComandas(empresaId, [data]))[0] ?? null;
}

export async function registrarPagamento(dados: {
  comandaId: string;
  valorCentavos: number;
  forma: Tables<"pagamentos">["forma"];
  observacao: string;
  recebidoCentavos: number | undefined;
}): Promise<void> {
  const obs = dados.observacao.trim();
  const { error } = await supabase.rpc("registrar_pagamento", {
    _comanda: dados.comandaId,
    _valor: dados.valorCentavos,
    _forma: dados.forma,
    ...(obs ? { _observacao: obs } : {}),
    ...(dados.recebidoCentavos !== undefined ? { _recebido: dados.recebidoCentavos } : {}),
  });
  if (error) falhar("registrarPagamento", error);
}

export async function excluirPagamento(id: string): Promise<void> {
  const { error } = await supabase.rpc("excluir_pagamento", { _pagamento: id });
  if (error) falhar("excluirPagamento", error);
}

export async function fecharComanda(id: string): Promise<void> {
  const { error } = await supabase.rpc("fechar_comanda", { _comanda: id });
  if (error) falhar("fecharComanda", error);
}

export async function iniciarFechamentoMesa(mesaId: string): Promise<void> {
  const { error } = await supabase.rpc("iniciar_fechamento_mesa", { _mesa: mesaId });
  if (error) falhar("iniciarFechamentoMesa", error);
}

export async function retomarAtendimentoMesa(mesaId: string): Promise<void> {
  const { error } = await supabase.rpc("retomar_atendimento_mesa", { _mesa: mesaId });
  if (error) falhar("retomarAtendimentoMesa", error);
}

export async function liberarMesa(mesaId: string): Promise<void> {
  const { error } = await supabase.rpc("liberar_mesa", { _mesa: mesaId });
  if (error) falhar("liberarMesa", error);
}
