// Domain types. All money values are integer centavos.

export type ID = string;

export interface Categoria {
  id: ID;
  nome: string;
  descricao?: string | undefined;
  ativa: boolean;
}

export interface Produto {
  id: ID;
  nome: string;
  descricao?: string | undefined;
  categoriaId: ID;
  precoCentavos: number;
  disponivel: boolean;
  imagemOpcional?: string | undefined;
  criadoEm: string;
}

export interface Mesa {
  id: ID;
  nome: string;
  ativa: boolean;
  sessaoAtualId: ID | null;
  criadaEm: string;
}

export type StatusSessao = "aberta" | "fechamento" | "encerrada";

export interface Sessao {
  id: ID;
  mesaId: ID;
  abertaEm: string;
  encerradaEm: string | null;
  status: StatusSessao;
}

export interface Cliente {
  id: ID;
  sessaoId: ID;
  nome: string;
  contaId: ID;
}

export type StatusConta = "aberta" | "paga";

export interface Conta {
  id: ID;
  sessaoId: ID;
  mesaId: ID;
  /** Snapshot for history, kept even if the table is renamed/deleted. */
  mesaNome: string;
  clienteId: ID;
  clienteNome: string;
  status: StatusConta;
  abertaEm: string;
  fechadaEm: string | null;
}

export interface ItemPedido {
  produtoId: ID;
  nomeProduto: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  subtotalCentavos: number;
}

export type StatusPedido = "pendente" | "confirmado" | "rejeitado";

export interface Pedido {
  id: ID;
  mesaId: ID;
  sessaoId: ID;
  contaId: ID;
  clienteId: ID;
  itens: ItemPedido[];
  totalCentavos: number;
  status: StatusPedido;
  criadoEm: string;
  confirmadoEm: string | null;
  rejeitadoEm: string | null;
  motivoRejeicao: string | null;
}

export type FormaPagamento = "dinheiro" | "pix" | "debito" | "credito" | "outro";

export interface Pagamento {
  id: ID;
  contaId: ID;
  valorCentavos: number;
  formaPagamento: FormaPagamento;
  criadoEm: string;
  observacao?: string | undefined;
  /** Cash only: amount handed over and change returned (change is not revenue). */
  recebidoCentavos?: number | undefined;
  trocoCentavos?: number | undefined;
}

export interface Configuracoes {
  nomeEstabelecimento: string;
  textoCardapio: string;
  /** Demo-only PIN. Not real security. */
  pinDemo: string;
}

export interface AppData {
  versao: 1;
  categorias: Categoria[];
  produtos: Produto[];
  mesas: Mesa[];
  sessoes: Sessao[];
  clientes: Cliente[];
  contas: Conta[];
  pedidos: Pedido[];
  pagamentos: Pagamento[];
  config: Configuracoes;
}

export const FORMAS_PAGAMENTO: { value: FormaPagamento; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "debito", label: "Cartão de débito" },
  { value: "credito", label: "Cartão de crédito" },
  { value: "outro", label: "Outra forma" },
];

export const rotuloForma = (f: FormaPagamento) =>
  FORMAS_PAGAMENTO.find((x) => x.value === f)?.label ?? f;
