import { formatBRL, formatDataHora } from "@/lib/format";
import { rotuloForma } from "@/lib/pedidos/rotulos";
import type { ComandaPainel } from "@/lib/pedidos/contas";
import type { PedidoPainel } from "@/lib/pedidos/painel";

// Cupons para impressora térmica de bobina (58 ou 80 mm). Tudo é gerado no navegador e impresso pelo
// diálogo de impressão do sistema; nada vai para o banco. A largura é uma escolha de cada aparelho.

export type LarguraCupom = 58 | 80;
export const CHAVE_LARGURA = "comanda-facil:cupom-largura";

export function lerLargura(): LarguraCupom {
  try {
    return localStorage.getItem(CHAVE_LARGURA) === "58" ? 58 : 80;
  } catch {
    return 80;
  }
}

export function salvarLargura(l: LarguraCupom): void {
  try {
    localStorage.setItem(CHAVE_LARGURA, String(l));
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
}

/** Composição dos combos: id do item do pedido → componentes (nome e quantidade por combo). */
export type Composicao = Map<string, { nome: string; quantidade: number }[]>;

export type EmpresaCupom = { nome: string; endereco?: string | null };

export function escapar(t: string): string {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Número curto para conversar com a equipe ("pedido 3FA9C1"): final do id do pedido. */
export const codigoDoPedido = (id: string): string => id.replace(/-/g, "").slice(-6).toUpperCase();

const linha = (esq: string, dir = ""): string =>
  `<div class="l"><span>${escapar(esq)}</span>${dir ? `<span class="v">${escapar(dir)}</span>` : ""}</div>`;
const centro = (t: string, cls = ""): string => `<div class="c ${cls}">${escapar(t)}</div>`;
const sep = '<div class="s"></div>';

function itemHtml(
  nome: string,
  qtd: number,
  valor: string | null,
  inclui: { nome: string; quantidade: number }[] | undefined,
): string {
  const extra = (inclui ?? [])
    .map((c) => `<div class="i">Inclui: ${c.quantidade * qtd}x ${escapar(c.nome)}</div>`)
    .join("");
  return `<div class="it">${linha(`${qtd}x ${nome}`, valor ?? "")}${extra}</div>`;
}

export function documento(corpo: string, largura: LarguraCupom): string {
  // A área imprimível das térmicas é um pouco menor que o papel (58 → ~48 mm, 80 → ~72 mm).
  const util = largura === 58 ? 48 : 72;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Cupom</title><style>
@page{size:${largura}mm auto;margin:0}
*{box-sizing:border-box}
body{margin:0;padding:3mm 0;width:${largura}mm;font-family:"Courier New",monospace;font-size:${largura === 58 ? 11 : 12}px;line-height:1.35;color:#000;background:#fff}
.w{width:${util}mm;margin:0 auto}
.c{text-align:center}.b{font-weight:700}.g{font-size:1.25em}
.l{display:flex;justify-content:space-between;gap:6px}.l .v{white-space:nowrap}
.l span:first-child{min-width:0;overflow-wrap:anywhere}
.i{padding-left:3ch;font-size:.92em}
.s{border-top:1px dashed #000;margin:5px 0}
.it{margin:2px 0}
</style></head><body><div class="w">${corpo}</div></body></html>`;
}

/** Cupom da cozinha/bar: mesa, cliente, hora, itens e valores do pedido confirmado. */
export function cupomPedidoHtml(
  empresa: EmpresaCupom,
  pedido: PedidoPainel,
  composicao: Composicao,
  largura: LarguraCupom,
): string {
  const itens = pedido.itens.filter((i) => i.status !== "cancelado");
  const total = itens.reduce((s, i) => s + (i.subtotal_centavos ?? 0), 0);
  const corpo = [
    centro(empresa.nome, "b"),
    centro("PEDIDO " + codigoDoPedido(pedido.id), "b g"),
    sep,
    linha("Mesa", String(pedido.mesa_numero)),
    linha("Cliente", pedido.cliente_nome),
    linha("Pedido", formatDataHora(pedido.criado_em)),
    pedido.confirmado_em ? linha("Confirmado", formatDataHora(pedido.confirmado_em)) : "",
    sep,
    ...itens.map((i) =>
      itemHtml(
        i.nome_produto,
        i.quantidade,
        formatBRL(i.subtotal_centavos ?? 0),
        composicao.get(i.id),
      ),
    ),
    sep,
    `<div class="b">${linha("TOTAL", formatBRL(total))}</div>`,
    sep,
    centro("Uso interno"),
  ].join("");
  return documento(corpo, largura);
}

/** Itens da conta somados por produto e preço (pedidos confirmados, sem cancelados). */
export function itensDaNota(
  conta: Pick<ComandaPainel, "pedidos">,
  composicao: Composicao,
): {
  nome: string;
  quantidade: number;
  unitario: number;
  subtotal: number;
  inclui?: { nome: string; quantidade: number }[];
}[] {
  const mapa = new Map<
    string,
    {
      nome: string;
      quantidade: number;
      unitario: number;
      subtotal: number;
      inclui?: { nome: string; quantidade: number }[];
    }
  >();
  for (const p of conta.pedidos) {
    if (p.status !== "confirmado") continue;
    for (const i of p.itens) {
      if (i.status === "cancelado") continue;
      const chave = `${i.produto_id ?? i.nome_produto}|${i.preco_unitario_centavos}`;
      const atual = mapa.get(chave);
      const inclui = composicao.get(i.id);
      if (atual) {
        atual.quantidade += i.quantidade;
        atual.subtotal += i.subtotal_centavos ?? 0;
      } else {
        mapa.set(chave, {
          nome: i.nome_produto,
          quantidade: i.quantidade,
          unitario: i.preco_unitario_centavos,
          subtotal: i.subtotal_centavos ?? 0,
          ...(inclui ? { inclui } : {}),
        });
      }
    }
  }
  return [...mapa.values()];
}

/** Recibo da conta (não fiscal): itens, total, pagamentos e troco. */
export function notaContaHtml(
  empresa: EmpresaCupom,
  conta: ComandaPainel,
  composicao: Composicao,
  largura: LarguraCupom,
  agora: Date = new Date(),
): string {
  const itens = itensDaNota(conta, composicao);
  const total = itens.reduce((s, i) => s + i.subtotal, 0);
  const pago = conta.pagamentos.reduce((s, g) => s + g.valor_centavos, 0);
  const saldo = total - pago;
  const corpo = [
    centro(empresa.nome, "b g"),
    empresa.endereco ? centro(empresa.endereco.replace(/\s*\n\s*/g, " · ")) : "",
    centro("RECIBO · SEM VALOR FISCAL"),
    sep,
    linha("Mesa", String(conta.mesa_numero)),
    linha("Cliente", conta.cliente_nome),
    linha("Aberta", formatDataHora(conta.aberta_em)),
    linha("Fechada", formatDataHora(conta.fechada_em ?? agora.toISOString())),
    sep,
    ...itens.map(
      (i) =>
        itemHtml(i.nome, i.quantidade, formatBRL(i.subtotal), i.inclui) +
        (i.quantidade > 1 ? `<div class="i">${formatBRL(i.unitario)} cada</div>` : ""),
    ),
    sep,
    `<div class="b g">${linha("TOTAL", formatBRL(total))}</div>`,
    sep,
    conta.pagamentos.length === 0 ? centro("Sem pagamentos") : centro("Pagamentos", "b"),
    ...conta.pagamentos.flatMap((g) => [
      linha(rotuloForma[g.forma], formatBRL(g.valor_centavos)),
      g.forma === "dinheiro" && g.recebido_centavos != null
        ? `<div class="i">Recebido ${formatBRL(g.recebido_centavos)} · troco ${formatBRL(g.troco_centavos ?? 0)}</div>`
        : "",
    ]),
    saldo !== 0
      ? `<div class="b">${linha(saldo > 0 ? "A PAGAR" : "CRÉDITO", formatBRL(Math.abs(saldo)))}</div>`
      : "",
    sep,
    centro("Obrigado pela preferência!"),
    centro("Comanda Fácil · INOV4 HUB"),
  ].join("");
  return documento(corpo, largura);
}

/** Imprime o HTML pelo diálogo do navegador, usando um iframe invisível (não troca a tela do painel). */
export function imprimirHtml(html: string): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  frame.srcdoc = html;
  frame.onload = () => {
    const w = frame.contentWindow;
    if (!w) {
      frame.remove();
      return;
    }
    w.focus();
    w.print();
    // Remove depois que o diálogo fecha (ou após um tempo, se o navegador não avisar).
    const limpar = () => setTimeout(() => frame.remove(), 500);
    w.addEventListener("afterprint", limpar, { once: true });
    setTimeout(() => frame.remove(), 120_000);
  };
  document.body.appendChild(frame);
}
