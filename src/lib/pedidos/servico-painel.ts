import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ErroPedido, codigoDoErro } from "./tipos";
import type { CaixaRow, MovimentoCaixa, ResumoCaixa } from "./caixa";
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
    chaveCaixas(empresaId),
    ["produtos", empresaId],
  ]) {
    void qc.invalidateQueries({ queryKey: chave });
  }
}

const LOTE = 80;

async function emLotes<T>(ids: string[], buscar: (lote: string[]) => Promise<T[]>): Promise<T[]> {
  const partes: string[][] = [];
  for (let i = 0; i < ids.length; i += LOTE) partes.push(ids.slice(i, i + LOTE));
  return (await Promise.all(partes.map(buscar))).flat();
}

export type SessaoPainel = Tables<"sessoes_mesa"> & {
  /** A mesa só conta como ocupada depois que o atendente aprova um pedido da sessão. */
  confirmada: boolean;
};

/** Sessões em andamento (mesas ocupadas ou em fechamento, ou só com gente identificada). */
export async function listarSessoesAtivas(empresaId: string): Promise<SessaoPainel[]> {
  const { data, error } = await supabase
    .from("sessoes_mesa")
    .select("*")
    .eq("estabelecimento_id", empresaId)
    .neq("status", "encerrada");
  if (error) falhar("listarSessoes", error);
  if (data.length === 0) return [];
  const confirmadas = await emLotes(
    data.map((x) => x.id),
    async (lote) => {
      const { data: peds, error: e2 } = await supabase
        .from("pedidos")
        .select("sessao_id")
        .eq("estabelecimento_id", empresaId)
        .eq("status", "confirmado")
        .in("sessao_id", lote);
      if (e2) falhar("listarSessoes/confirmadas", e2);
      return peds.map((x) => x.sessao_id);
    },
  );
  const comConfirmado = new Set(confirmadas);
  return data.map((x) => ({ ...x, confirmada: comConfirmado.has(x.id) }));
}

async function montarComandas(
  empresaId: string,
  comandas: Tables<"comandas">[],
): Promise<ComandaPainel[]> {
  if (comandas.length === 0) return [];
  const pedidos = await emLotes(
    comandas.map((c) => c.id),
    async (lote) => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("estabelecimento_id", empresaId)
        .in("comanda_id", lote);
      if (error) falhar("comandas/pedidos", error);
      return data;
    },
  );
  const pagamentos = await emLotes(
    comandas.map((c) => c.id),
    async (lote) => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("estabelecimento_id", empresaId)
        .in("comanda_id", lote);
      if (error) falhar("comandas/pagamentos", error);
      return data;
    },
  );
  const itens = await emLotes(
    pedidos.map((p) => p.id),
    async (lote) => {
      const { data, error } = await supabase
        .from("itens_pedido")
        .select("*")
        .eq("estabelecimento_id", empresaId)
        .in("pedido_id", lote);
      if (error) falhar("comandas/itens", error);
      return data;
    },
  );

  return comandas.map((c) => ({
    ...c,
    pagamentos: pagamentos
      .filter((g) => g.comanda_id === c.id)
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
    pedidos: pedidos
      .filter((p) => p.comanda_id === c.id)
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
      .map((p) => ({
        ...p,
        cliente_nome: c.cliente_nome,
        mesa_numero: c.mesa_numero,
        itens: itens
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

export const LIMITE_VENDAS = 500;

/** Contas fechadas (vendas) com fechamento em [inicio, fim). Mais recentes primeiro. */
export async function listarContasFechadas(
  empresaId: string,
  inicio: Date,
  fim: Date,
): Promise<{ contas: ComandaPainel[]; truncado: boolean }> {
  const { data, error } = await supabase
    .from("comandas")
    .select(COLUNAS_COMANDA)
    .eq("estabelecimento_id", empresaId)
    .eq("status", "paga")
    .gte("fechada_em", inicio.toISOString())
    .lt("fechada_em", fim.toISOString())
    .order("fechada_em", { ascending: false })
    .limit(LIMITE_VENDAS);
  if (error) falhar("listarContasFechadas", error);
  return { contas: await montarComandas(empresaId, data), truncado: data.length >= LIMITE_VENDAS };
}

export const chaveVendas = (empresaId: string, de: string, ate: string) =>
  [...chaveComandas(empresaId), "fechadas", de, ate] as const;

// ---------- Caixa (tesouraria) ----------

export const chaveCaixas = (empresaId: string) => ["caixas", empresaId] as const;

const LIMITE_CAIXAS = 60;

/** Caixas da empresa, do mais recente para o mais antigo. */
export async function listarCaixas(empresaId: string): Promise<CaixaRow[]> {
  const { data, error } = await supabase
    .from("caixas")
    .select("*")
    .eq("estabelecimento_id", empresaId)
    .order("aberto_em", { ascending: false })
    .limit(LIMITE_CAIXAS);
  if (error) falhar("listarCaixas", error);
  return data;
}

export async function obterResumoCaixa(caixaId: string): Promise<ResumoCaixa> {
  const { data, error } = await supabase.rpc("resumo_caixa", { _caixa: caixaId });
  if (error) falhar("obterResumoCaixa", error);
  return data as unknown as ResumoCaixa;
}

export async function listarMovimentosCaixa(caixaId: string): Promise<MovimentoCaixa[]> {
  const { data, error } = await supabase
    .from("movimentos_caixa")
    .select("*")
    .eq("caixa_id", caixaId)
    .order("criado_em", { ascending: false });
  if (error) falhar("listarMovimentosCaixa", error);
  return data;
}

export async function abrirCaixa(empresaId: string, valorCentavos: number): Promise<void> {
  const { error } = await supabase.rpc("abrir_caixa", {
    _empresa: empresaId,
    _valor: valorCentavos,
  });
  if (error) falhar("abrirCaixa", error);
}

export async function movimentarCaixa(dados: {
  caixaId: string;
  tipo: "sangria" | "reforco";
  valorCentavos: number;
  motivo: string;
}): Promise<void> {
  const { error } = await supabase.rpc("movimentar_caixa", {
    _caixa: dados.caixaId,
    _tipo: dados.tipo,
    _valor: dados.valorCentavos,
    _motivo: dados.motivo.trim(),
  });
  if (error) falhar("movimentarCaixa", error);
}

/** Devolve a diferença (contado − esperado) em centavos. */
export async function fecharCaixa(
  caixaId: string,
  contadoCentavos: number,
  observacao: string,
): Promise<number> {
  const obs = observacao.trim();
  const { data, error } = await supabase.rpc("fechar_caixa", {
    _caixa: caixaId,
    _contado: contadoCentavos,
    ...(obs ? { _observacao: obs } : {}),
  });
  if (error) falhar("fecharCaixa", error);
  return data;
}
