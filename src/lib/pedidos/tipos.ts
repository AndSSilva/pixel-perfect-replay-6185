import type { Tables } from "@/integrations/supabase/types";

// ---------- Erros (mensagens das funções do banco, docs/sql/08_pedidos.sql) ----------
export const MENSAGENS_PEDIDO = {
  nome_invalido: "Informe seu nome (até 40 caracteres).",
  empresa_indisponivel: "Este estabelecimento não está disponível no momento.",
  mesa_indisponivel: "Esta mesa não está disponível.",
  mesa_em_fechamento: "A mesa está sendo fechada. Chame o atendente.",
  muitos_clientes: "Há comandas demais abertas nesta mesa. Chame o atendente.",
  comanda_invalida: "Não encontramos sua comanda. Identifique-se novamente.",
  comanda_fechada: "Esta comanda já foi encerrada.",
  itens_invalidos: "Confira os itens do pedido.",
  produto_indisponivel: "Um dos itens não está mais disponível.",
  quantidade_indisponivel: "A quantidade pedida não está mais disponível.",
  muitos_pedidos_pendentes: "Há pedidos demais aguardando confirmação. Aguarde o atendente.",
  pedido_nao_encontrado: "Pedido não encontrado. Atualize a tela.",
  pedido_nao_pendente: "Este pedido não está mais pendente. Atualize a tela.",
  pedido_expirado: "Este pedido expirou. Rejeite-o e peça para refazer.",
  item_nao_entregavel: "Este item não pode mais ser entregue.",
  item_nao_cancelavel: "Este item não pode mais ser cancelado.",
  item_nao_encontrado: "Item não encontrado. Atualize a tela.",
  motivo_obrigatorio: "Informe o motivo do cancelamento.",
  motivo_invalido: "O motivo deve ter até 200 caracteres.",
  nada_a_entregar: "Não há itens aguardando entrega neste pedido.",
  estoque_insuficiente: "Estoque insuficiente para entregar. Reponha o estoque ou cancele o item.",
  valor_invalido: "Informe um valor maior que zero.",
  valor_excede_saldo: "O valor é maior que o saldo da conta.",
  recebido_menor_que_valor: "O valor recebido é menor que o valor pago.",
  observacao_invalida: "A observação deve ter até 200 caracteres.",
  pendencias: "Ainda há pendências nesta conta.",
  pedidos_pendentes: "Há pedidos pendentes. Confirme ou rejeite antes.",
  itens_nao_entregues: "Há itens aguardando entrega. Entregue ou cancele antes.",
  saldo_em_aberto: "A conta ainda tem saldo em aberto.",
  comandas_em_aberto: "Ainda há comandas abertas nesta mesa.",
  mesa_sem_atendimento: "Esta mesa não tem atendimento em andamento.",
  mesa_nao_encontrada: "Mesa não encontrada.",
  comanda_nao_encontrada: "Comanda não encontrada. Atualize a tela.",
  pagamento_nao_encontrado: "Pagamento não encontrado. Atualize a tela.",
  caixa_ja_aberto: "Já existe um caixa aberto nesta empresa.",
  caixa_fechado: "Não há caixa aberto. Abra o caixa para continuar.",
  caixa_ja_fechado: "Este caixa já foi fechado e não pode mais ser alterado.",
  caixa_nao_encontrado: "Caixa não encontrado. Atualize a tela.",
  valor_excede_caixa: "A sangria é maior que o dinheiro esperado no caixa.",
  sem_permissao: "Você não tem permissão para esta ação (a empresa pode estar desativada).",
  desconhecido: "Não foi possível concluir. Tente novamente.",
} as const;

export type CodigoErroPedido = keyof typeof MENSAGENS_PEDIDO;

export class ErroPedido extends Error {
  constructor(
    public readonly codigo: CodigoErroPedido,
    /** Detalhe devolvido pelo banco (ex.: saldo, ou o item sem estoque). */
    public readonly detalhe?: string,
  ) {
    super(MENSAGENS_PEDIDO[codigo]);
    this.name = "ErroPedido";
  }
}

/** Converte o erro de uma função do banco em um código nosso. */
export function codigoDoErro(e: {
  code?: string | undefined;
  message?: string | undefined;
}): CodigoErroPedido {
  const msg = (e.message ?? "").trim();
  if ((Object.keys(MENSAGENS_PEDIDO) as string[]).includes(msg) && msg !== "desconhecido") {
    return msg as CodigoErroPedido;
  }
  if (e.code === "42501") return "sem_permissao";
  return "desconhecido";
}

export const mensagemDoErroPedido = (e: unknown): string =>
  e instanceof ErroPedido ? e.message : MENSAGENS_PEDIDO.desconhecido;

// ---------- Cardápio público e comanda do cliente (JSON das funções) ----------
export type ProdutoCardapio = {
  id: string;
  nome: string;
  descricao: string | null;
  preco_venda_centavos: number;
  foto_path: string | null;
  esgotado: boolean;
  /** null = sem limite (interruptor desligado). */
  qtd_disponivel: number | null;
};

export type CardapioPublico = {
  empresa: {
    nome: string;
    slug: string;
    cor_primaria: string;
    cor_secundaria: string;
    logo_url: string | null;
  };
  mesa: { numero: number; ativa: boolean };
  categorias: {
    id: string;
    nome: string;
    descricao: string | null;
    produtos: ProdutoCardapio[];
  }[];
};

export type ItemComandaCliente = {
  id: string;
  nome_produto: string;
  quantidade: number;
  preco_unitario_centavos: number;
  subtotal_centavos: number;
  status: Tables<"itens_pedido">["status"];
  motivo_cancelamento: string | null;
};

export type PedidoComandaCliente = {
  id: string;
  status: Tables<"pedidos">["status"];
  criado_em: string;
  expira_em: string;
  expirado: boolean;
  motivo_rejeicao: string | null;
  itens: ItemComandaCliente[];
};

export type ComandaCliente = {
  comanda: {
    id: string;
    cliente_nome: string;
    status: Tables<"comandas">["status"];
    mesa_numero: number;
    sessao_status: Tables<"sessoes_mesa">["status"];
  };
  empresa: { nome: string; slug: string };
  devido_centavos: number;
  pago_centavos: number;
  saldo_centavos: number;
  pedidos: PedidoComandaCliente[];
  pagamentos: {
    valor_centavos: number;
    forma: Tables<"pagamentos">["forma"];
    criado_em: string;
  }[];
};

export type LinhaPedido = { produto_id: string; quantidade: number };
