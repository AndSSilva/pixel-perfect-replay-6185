import type { AppData, Pedido } from "./types";
import { novoId } from "./services/regras";

/** Builds the demo scenario. Called lazily (never at module load). */
export function criarDadosDemo(): AppData {
  const now = Date.now();
  const t = (minAtras: number) => new Date(now - minAtras * 60_000).toISOString();

  const cat = (nome: string, descricao?: string) => ({ id: novoId(), nome, descricao, ativa: true });
  const cervejas = cat("Cervejas", "Long necks e garrafas geladas");
  const refri = cat("Refrigerantes");
  const aguas = cat("Águas");
  const energ = cat("Energéticos");
  const dest = cat("Destilados", "Doses");
  const outros = cat("Outros");

  const prod = (nome: string, categoriaId: string, reais: number, descricao?: string, disponivel = true) => ({
    id: novoId(),
    nome,
    descricao,
    categoriaId,
    precoCentavos: Math.round(reais * 100),
    disponivel,
    criadoEm: t(60 * 24 * 10),
  });
  const heineken = prod("Heineken Long Neck", cervejas.id, 12, "330 ml");
  const brahma = prod("Brahma Chopp 600 ml", cervejas.id, 14, "Garrafa retornável");
  const original = prod("Original 600 ml", cervejas.id, 15);
  const corona = prod("Corona Extra", cervejas.id, 13, "330 ml", false);
  const coca = prod("Coca-Cola Lata", refri.id, 6, "350 ml");
  const guarana = prod("Guaraná Antarctica Lata", refri.id, 5.5, "350 ml");
  const agua = prod("Água Mineral sem Gás", aguas.id, 4, "500 ml");
  const aguaGas = prod("Água com Gás", aguas.id, 4.5, "500 ml");
  const redbull = prod("Red Bull", energ.id, 14, "250 ml");
  const monster = prod("Monster Energy", energ.id, 11, "473 ml");
  const cachaca = prod("Dose de Cachaça", dest.id, 8, "50 ml");
  const whisky = prod("Dose de Whisky", dest.id, 22, "50 ml");
  const gelo = prod("Saco de Gelo", outros.id, 7, "2 kg");

  const mesas = Array.from({ length: 6 }, (_, i) => ({
    id: novoId(),
    nome: `Mesa ${String(i + 1).padStart(2, "0")}`,
    ativa: true,
    sessaoAtualId: null as string | null,
    criadaEm: t(60 * 24 * 30),
  }));

  const d: AppData = {
    versao: 1,
    categorias: [cervejas, refri, aguas, energ, dest, outros],
    produtos: [heineken, brahma, original, corona, coca, guarana, agua, aguaGas, redbull, monster, cachaca, whisky, gelo],
    mesas,
    sessoes: [],
    clientes: [],
    contas: [],
    pedidos: [],
    pagamentos: [],
    config: {
      nomeEstabelecimento: "Adega Ponto Gelado",
      textoCardapio: "Bebidas trincando de geladas. Peça pelo celular e aguarde a confirmação.",
      pinDemo: "1234",
    },
  };

  type P = { id: string; precoCentavos: number; nome: string };
  const sessao = (mesaIdx: number, abertaMin: number, encerradaMin: number | null) => {
    const s = {
      id: novoId(),
      mesaId: mesas[mesaIdx]!.id,
      abertaEm: t(abertaMin),
      encerradaEm: encerradaMin === null ? null : t(encerradaMin),
      status: (encerradaMin === null ? "aberta" : "encerrada") as "aberta" | "encerrada",
    };
    d.sessoes.push(s);
    if (encerradaMin === null) mesas[mesaIdx]!.sessaoAtualId = s.id;
    return s;
  };
  const conta = (s: { id: string; mesaId: string }, nome: string, abertaMin: number, fechadaMin: number | null) => {
    const clienteId = novoId();
    const contaId = novoId();
    const mesa = mesas.find((m) => m.id === s.mesaId)!;
    d.clientes.push({ id: clienteId, sessaoId: s.id, nome, contaId });
    d.contas.push({
      id: contaId,
      sessaoId: s.id,
      mesaId: s.mesaId,
      mesaNome: mesa.nome,
      clienteId,
      clienteNome: nome,
      status: fechadaMin === null ? "aberta" : "paga",
      abertaEm: t(abertaMin),
      fechadaEm: fechadaMin === null ? null : t(fechadaMin),
    });
    return d.contas[d.contas.length - 1]!;
  };
  const pedido = (
    c: { id: string; sessaoId: string; mesaId: string; clienteId: string },
    itens: [P, number][],
    min: number,
    status: Pedido["status"],
    motivo?: string,
  ) => {
    const linhas = itens.map(([p, q]) => ({
      produtoId: p.id,
      nomeProduto: p.nome,
      quantidade: q,
      precoUnitarioCentavos: p.precoCentavos,
      subtotalCentavos: p.precoCentavos * q,
    }));
    d.pedidos.push({
      id: novoId(),
      mesaId: c.mesaId,
      sessaoId: c.sessaoId,
      contaId: c.id,
      clienteId: c.clienteId,
      itens: linhas,
      totalCentavos: linhas.reduce((s, l) => s + l.subtotalCentavos, 0),
      status,
      criadoEm: t(min),
      confirmadoEm: status === "confirmado" ? t(min - 2) : null,
      rejeitadoEm: status === "rejeitado" ? t(min - 2) : null,
      motivoRejeicao: motivo ?? null,
    });
  };
  const pagar = (contaId: string, reais: number, forma: AppData["pagamentos"][number]["formaPagamento"], min: number) =>
    d.pagamentos.push({ id: novoId(), contaId, valorCentavos: Math.round(reais * 100), formaPagamento: forma, criadoEm: t(min) });

  // Histórico: ontem, Mesa 01
  const s1 = sessao(0, 60 * 26, 60 * 23);
  const c1 = conta(s1, "Marcos", 60 * 26, 60 * 23);
  pedido(c1, [[brahma, 3], [cachaca, 2]], 60 * 25, "confirmado"); // 58
  pagar(c1.id, 58, "pix", 60 * 23);
  const c2 = conta(s1, "Júlia", 60 * 26, 60 * 23);
  pedido(c2, [[heineken, 2], [agua, 1]], 60 * 25, "confirmado"); // 28
  pagar(c2.id, 20, "debito", 60 * 23);
  pagar(c2.id, 8, "dinheiro", 60 * 23);

  // Histórico: hoje, Mesa 03
  const s3 = sessao(2, 180, 90);
  const c3 = conta(s3, "Rafael", 180, 95);
  pedido(c3, [[original, 2], [redbull, 1]], 170, "confirmado"); // 44
  pedido(c3, [[whisky, 1]], 150, "rejeitado", "Produto em falta no momento");
  pagar(c3.id, 44, "credito", 95);

  // Mesa 02 ocupada: duas contas, uma com pagamento parcial
  const s2 = sessao(1, 75, null);
  const ana = conta(s2, "Ana", 75, null);
  pedido(ana, [[heineken, 2], [coca, 1]], 70, "confirmado"); // 30
  pedido(ana, [[heineken, 1]], 40, "confirmado"); // 12
  pagar(ana.id, 20, "pix", 15);
  const bruno = conta(s2, "Bruno", 72, null);
  pedido(bruno, [[brahma, 2]], 65, "confirmado"); // 28
  pedido(bruno, [[cachaca, 2], [gelo, 1]], 6, "pendente");

  // Mesa 05 ocupada com pedido pendente
  const s5 = sessao(4, 20, null);
  const carla = conta(s5, "Carla", 20, null);
  pedido(carla, [[monster, 1], [aguaGas, 2]], 3, "pendente");

  return d;
}
