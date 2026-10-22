// Business rules as functions that mutate a draft AppData and throw RegraError on violations.
// The store clones state before calling these, so a throw leaves the saved data untouched.
// To move to a backend later, replace these calls with API requests behind the same names.
import type {
  AppData,
  Categoria,
  Conta,
  Configuracoes,
  FormaPagamento,
  ID,
  Mesa,
  Pedido,
  Produto,
} from "../types";
import { formatBRL } from "../format";

export class RegraError extends Error {}

const agora = () => new Date().toISOString();
export const novoId = () => crypto.randomUUID();
function exigir(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new RegraError(msg);
};

// ---------- Cálculos (sempre derivados de itens e pagamentos) ----------

export const totalConfirmadoConta = (d: AppData, contaId: ID) =>
  d.pedidos
    .filter((p) => p.contaId === contaId && p.status === "confirmado")
    .reduce((s, p) => s + p.totalCentavos, 0);

export const totalPagoConta = (d: AppData, contaId: ID) =>
  d.pagamentos.filter((p) => p.contaId === contaId).reduce((s, p) => s + p.valorCentavos, 0);

export const saldoConta = (d: AppData, contaId: ID) =>
  totalConfirmadoConta(d, contaId) - totalPagoConta(d, contaId);

export const pedidosPendentesConta = (d: AppData, contaId: ID) =>
  d.pedidos.filter((p) => p.contaId === contaId && p.status === "pendente");

export const sessaoAtual = (d: AppData, mesa: Mesa) =>
  mesa.sessaoAtualId ? d.sessoes.find((s) => s.id === mesa.sessaoAtualId) ?? null : null;

export const contasDaSessao = (d: AppData, sessaoId: ID) =>
  d.contas.filter((c) => c.sessaoId === sessaoId);

export type StatusMesa = "disponivel" | "ocupada" | "aguardando" | "inativa";

export function statusMesa(d: AppData, mesa: Mesa): StatusMesa {
  if (!mesa.ativa) return "inativa";
  const s = sessaoAtual(d, mesa);
  if (!s) return "disponivel";
  if (s.status === "fechamento") return "aguardando";
  const contas = contasDaSessao(d, s.id);
  const pendentes = d.pedidos.some((p) => p.sessaoId === s.id && p.status === "pendente");
  if (contas.length > 0 && !pendentes && contas.every((c) => c.status === "paga")) return "aguardando";
  return "ocupada";
}

// ---------- Categorias ----------

export function salvarCategoria(
  d: AppData,
  input: { id?: ID; nome: string; descricao?: string; ativa: boolean },
): ID {
  const nome = input.nome.trim();
  exigir(nome.length > 0, "Informe o nome da categoria.");
  exigir(
    !d.categorias.some((c) => c.id !== input.id && c.nome.toLowerCase() === nome.toLowerCase()),
    "Já existe uma categoria com esse nome.",
  );
  if (input.id) {
    const c = d.categorias.find((x) => x.id === input.id);
    exigir(c, "Categoria não encontrada.");
    Object.assign(c, { nome, descricao: input.descricao?.trim() || undefined, ativa: input.ativa });
    return c.id;
  }
  const c: Categoria = { id: novoId(), nome, descricao: input.descricao?.trim() || undefined, ativa: input.ativa };
  d.categorias.push(c);
  return c.id;
}

/** A category with products can only be deleted when a destination category is given. */
export function excluirCategoria(d: AppData, id: ID, destinoId?: ID) {
  const vinculados = d.produtos.filter((p) => p.categoriaId === id);
  if (vinculados.length > 0) {
    exigir(destinoId, "Esta categoria possui produtos. Escolha outra categoria para reclassificá-los.");
    exigir(destinoId !== id && d.categorias.some((c) => c.id === destinoId), "Categoria de destino inválida.");
    vinculados.forEach((p) => (p.categoriaId = destinoId));
  }
  d.categorias = d.categorias.filter((c) => c.id !== id);
}

// ---------- Produtos ----------

export function salvarProduto(
  d: AppData,
  input: { id?: ID; nome: string; descricao?: string; categoriaId: ID; precoCentavos: number | null; disponivel: boolean; imagemOpcional?: string },
): ID {
  const nome = input.nome.trim();
  exigir(nome.length > 0, "Informe o nome do produto.");
  exigir(d.categorias.some((c) => c.id === input.categoriaId), "Selecione uma categoria válida.");
  exigir(
    input.precoCentavos !== null && Number.isInteger(input.precoCentavos) && input.precoCentavos >= 0,
    "Informe um preço válido, não negativo.",
  );
  const dados = {
    nome,
    descricao: input.descricao?.trim() || undefined,
    categoriaId: input.categoriaId,
    precoCentavos: input.precoCentavos,
    disponivel: input.disponivel,
  };
  if (input.id) {
    const p = d.produtos.find((x) => x.id === input.id);
    exigir(p, "Produto não encontrado.");
    Object.assign(p, dados);
    return p.id;
  }
  const p: Produto = { id: novoId(), criadoEm: agora(), ...dados };
  d.produtos.push(p);
  return p.id;
}

export function alternarDisponibilidade(d: AppData, id: ID) {
  const p = d.produtos.find((x) => x.id === id);
  exigir(p, "Produto não encontrado.");
  p.disponivel = !p.disponivel;
}

/** Order items keep their own name/price snapshot, so history survives deletion. */
export function excluirProduto(d: AppData, id: ID) {
  d.produtos = d.produtos.filter((p) => p.id !== id);
}

// ---------- Mesas ----------

export function salvarMesa(d: AppData, input: { id?: ID; nome: string; ativa: boolean }): ID {
  const nome = input.nome.trim();
  exigir(nome.length > 0, "Informe o nome ou número da mesa.");
  exigir(
    !d.mesas.some((m) => m.id !== input.id && m.nome.toLowerCase() === nome.toLowerCase()),
    "Já existe uma mesa com esse nome.",
  );
  if (input.id) {
    const m = d.mesas.find((x) => x.id === input.id);
    exigir(m, "Mesa não encontrada.");
    if (!input.ativa) exigir(!m.sessaoAtualId, "Não é possível desativar uma mesa em atendimento.");
    m.nome = nome;
    m.ativa = input.ativa;
    return m.id;
  }
  const m: Mesa = { id: novoId(), nome, ativa: input.ativa, sessaoAtualId: null, criadaEm: agora() };
  d.mesas.push(m);
  return m.id;
}

export function excluirMesa(d: AppData, id: ID) {
  const m = d.mesas.find((x) => x.id === id);
  exigir(m, "Mesa não encontrada.");
  exigir(!m.sessaoAtualId, "Não é possível excluir uma mesa em atendimento.");
  exigir(
    !d.pedidos.some((p) => p.mesaId === id && p.status === "pendente"),
    "Esta mesa possui pedidos pendentes.",
  );
  exigir(!d.contas.some((c) => c.mesaId === id && c.status === "aberta"), "Esta mesa possui contas em aberto.");
  d.mesas = d.mesas.filter((x) => x.id !== id);
}

// ---------- Clientes e contas ----------

export function contasAbertasComNome(d: AppData, mesaId: ID, nome: string): Conta[] {
  const m = d.mesas.find((x) => x.id === mesaId);
  if (!m?.sessaoAtualId) return [];
  const alvo = nome.trim().toLowerCase();
  return d.contas.filter(
    (c) => c.sessaoId === m.sessaoAtualId && c.status === "aberta" && c.clienteNome.toLowerCase() === alvo,
  );
}

/** Opens the table session if needed and returns the customer's individual bill id. */
export function identificarCliente(d: AppData, mesaId: ID, nomeBruto: string, contaExistenteId?: ID): ID {
  const mesa = d.mesas.find((m) => m.id === mesaId);
  exigir(mesa && mesa.ativa, "Esta mesa não está disponível para pedidos.");
  if (contaExistenteId) {
    const c = d.contas.find((x) => x.id === contaExistenteId);
    exigir(
      c && c.status === "aberta" && c.sessaoId === mesa.sessaoAtualId,
      "Essa conta não está mais aberta nesta mesa.",
    );
    return c.id;
  }
  const nome = nomeBruto.trim();
  exigir(nome.length >= 1 && nome.length <= 40, "Informe um nome ou apelido de até 40 caracteres.");
  let sessaoId = mesa.sessaoAtualId;
  if (!sessaoId) {
    sessaoId = novoId();
    d.sessoes.push({ id: sessaoId, mesaId, abertaEm: agora(), encerradaEm: null, status: "aberta" });
    mesa.sessaoAtualId = sessaoId;
  }
  const clienteId = novoId();
  const contaId = novoId();
  d.clientes.push({ id: clienteId, sessaoId, nome, contaId });
  d.contas.push({
    id: contaId,
    sessaoId,
    mesaId,
    mesaNome: mesa.nome,
    clienteId,
    clienteNome: nome,
    status: "aberta",
    abertaEm: agora(),
    fechadaEm: null,
  });
  return contaId;
}

// ---------- Pedidos ----------

export function enviarPedido(d: AppData, contaId: ID, itens: { produtoId: ID; quantidade: number }[]): ID {
  const conta = d.contas.find((c) => c.id === contaId);
  exigir(conta && conta.status === "aberta", "Sua conta não está aberta.");
  const mesa = d.mesas.find((m) => m.id === conta.mesaId);
  exigir(mesa && mesa.ativa && mesa.sessaoAtualId === conta.sessaoId, "Esta mesa não está disponível para pedidos.");
  exigir(itens.length > 0, "Adicione ao menos um item ao pedido.");
  const agrupado = new Map<ID, number>();
  for (const i of itens) {
    exigir(Number.isInteger(i.quantidade) && i.quantidade > 0, "As quantidades devem ser números inteiros positivos.");
    agrupado.set(i.produtoId, (agrupado.get(i.produtoId) ?? 0) + i.quantidade);
  }
  const linhas = [...agrupado].map(([produtoId, quantidade]) => {
    const p = d.produtos.find((x) => x.id === produtoId);
    exigir(p && p.disponivel, `O produto ${p?.nome ?? ""} não está disponível.`.replace("  ", " "));
    return {
      produtoId,
      nomeProduto: p.nome,
      quantidade,
      precoUnitarioCentavos: p.precoCentavos,
      subtotalCentavos: p.precoCentavos * quantidade,
    };
  });
  const pedido: Pedido = {
    id: novoId(),
    mesaId: conta.mesaId,
    sessaoId: conta.sessaoId,
    contaId,
    clienteId: conta.clienteId,
    itens: linhas,
    totalCentavos: linhas.reduce((s, l) => s + l.subtotalCentavos, 0),
    status: "pendente",
    criadoEm: agora(),
    confirmadoEm: null,
    rejeitadoEm: null,
    motivoRejeicao: null,
  };
  d.pedidos.push(pedido);
  return pedido.id;
}

export function confirmarPedido(d: AppData, id: ID) {
  const p = d.pedidos.find((x) => x.id === id);
  exigir(p, "Pedido não encontrado.");
  exigir(p.status === "pendente", "Apenas pedidos pendentes podem ser confirmados.");
  const conta = d.contas.find((c) => c.id === p.contaId);
  exigir(conta && conta.status === "aberta", "A conta deste pedido já foi fechada.");
  p.status = "confirmado";
  p.confirmadoEm = agora();
}

export function rejeitarPedido(d: AppData, id: ID, motivo?: string) {
  const p = d.pedidos.find((x) => x.id === id);
  exigir(p, "Pedido não encontrado.");
  exigir(p.status === "pendente", "Apenas pedidos pendentes podem ser rejeitados.");
  p.status = "rejeitado";
  p.rejeitadoEm = agora();
  p.motivoRejeicao = motivo?.trim() || null;
}

// ---------- Pagamentos e fechamento ----------

export function registrarPagamento(
  d: AppData,
  input: { contaId: ID; valorCentavos: number | null; forma: FormaPagamento; observacao?: string; recebidoCentavos?: number | null },
): ID {
  const conta = d.contas.find((c) => c.id === input.contaId);
  exigir(conta && conta.status === "aberta", "Esta conta não está aberta.");
  const v = input.valorCentavos;
  exigir(v !== null && Number.isInteger(v) && v > 0, "Informe um valor positivo.");
  const saldo = saldoConta(d, conta.id);
  exigir(v <= saldo, `O valor excede o saldo devido de ${formatBRL(saldo)}.`);
  let troco: number | undefined;
  let recebido: number | undefined;
  if (input.forma === "dinheiro" && input.recebidoCentavos != null) {
    exigir(input.recebidoCentavos >= v, "O valor recebido deve ser maior ou igual ao valor do pagamento.");
    recebido = input.recebidoCentavos;
    troco = recebido - v;
  }
  const id = novoId();
  d.pagamentos.push({
    id,
    contaId: conta.id,
    valorCentavos: v,
    formaPagamento: input.forma,
    criadoEm: agora(),
    observacao: input.observacao?.trim() || undefined,
    recebidoCentavos: recebido,
    trocoCentavos: troco,
  });
  return id;
}

export function excluirPagamento(d: AppData, id: ID) {
  const pg = d.pagamentos.find((p) => p.id === id);
  exigir(pg, "Pagamento não encontrado.");
  const conta = d.contas.find((c) => c.id === pg.contaId);
  exigir(conta?.status === "aberta", "Não é possível remover pagamentos de uma conta fechada.");
  d.pagamentos = d.pagamentos.filter((p) => p.id !== id);
}

export function fecharConta(d: AppData, contaId: ID) {
  const conta = d.contas.find((c) => c.id === contaId);
  exigir(conta && conta.status === "aberta", "Esta conta já está fechada.");
  exigir(pedidosPendentesConta(d, contaId).length === 0, "Confirme ou rejeite os pedidos pendentes antes de fechar.");
  const saldo = saldoConta(d, contaId);
  exigir(saldo === 0, `Ainda há saldo em aberto de ${formatBRL(saldo)}.`);
  conta.status = "paga";
  conta.fechadaEm = agora();
}

export function iniciarFechamento(d: AppData, mesaId: ID) {
  const mesa = d.mesas.find((m) => m.id === mesaId);
  exigir(mesa, "Mesa não encontrada.");
  const s = sessaoAtual(d, mesa);
  exigir(s, "A mesa não possui atendimento ativo.");
  s.status = "fechamento";
}

export function retomarAtendimento(d: AppData, mesaId: ID) {
  const mesa = d.mesas.find((m) => m.id === mesaId);
  const s = mesa && sessaoAtual(d, mesa);
  exigir(s, "A mesa não possui atendimento ativo.");
  s.status = "aberta";
}

export function liberarMesa(d: AppData, mesaId: ID) {
  const mesa = d.mesas.find((m) => m.id === mesaId);
  exigir(mesa, "Mesa não encontrada.");
  const s = sessaoAtual(d, mesa);
  exigir(s, "A mesa já está disponível.");
  exigir(
    !d.pedidos.some((p) => p.sessaoId === s.id && p.status === "pendente"),
    "Há pedidos pendentes nesta mesa.",
  );
  exigir(
    contasDaSessao(d, s.id).every((c) => c.status === "paga"),
    "Há contas em aberto nesta mesa. Feche todas antes de liberar.",
  );
  s.status = "encerrada";
  s.encerradaEm = agora();
  mesa.sessaoAtualId = null;
}

// ---------- Configurações ----------

export function salvarConfig(d: AppData, cfg: Configuracoes) {
  exigir(cfg.nomeEstabelecimento.trim().length > 0, "Informe o nome do estabelecimento.");
  exigir(/^\d{4,8}$/.test(cfg.pinDemo), "O PIN deve ter de 4 a 8 dígitos.");
  d.config = {
    nomeEstabelecimento: cfg.nomeEstabelecimento.trim(),
    textoCardapio: cfg.textoCardapio.trim(),
    pinDemo: cfg.pinDemo,
  };
}
