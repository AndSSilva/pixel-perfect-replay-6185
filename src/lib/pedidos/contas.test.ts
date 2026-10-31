import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import {
  comandaTemAtividade,
  devidoDaComanda,
  impedimentoParaFechar,
  impedimentoParaLiberar,
  situacaoDaMesa,
  validarPagamento,
  type ComandaPainel,
} from "./contas";
import type { PedidoPainel } from "./painel";

const AGORA = new Date("2026-10-30T12:00:00Z").getTime();
const item = (o: Partial<Tables<"itens_pedido">>): Tables<"itens_pedido"> => ({
  cancelado_em: null,
  custo_unitario_centavos: null,
  entregue_em: null,
  estabelecimento_id: "e",
  id: "i",
  motivo_cancelamento: null,
  nome_produto: "X",
  pedido_id: "p",
  preco_unitario_centavos: 100,
  produto_id: null,
  quantidade: 1,
  status: "entregue",
  subtotal_centavos: 1000,
  ...o,
});
const pedido = (o: Partial<PedidoPainel>): PedidoPainel => ({
  comanda_id: "c",
  confirmado_em: null,
  criado_em: "2026-10-30T11:00:00Z",
  estabelecimento_id: "e",
  expira_em: "2026-10-30T11:45:00Z",
  id: "p",
  mesa_id: "m",
  motivo_rejeicao: null,
  rejeitado_em: null,
  sessao_id: "s",
  status: "confirmado",
  cliente_nome: "Ana",
  mesa_numero: 1,
  itens: [item({})],
  ...o,
});
const pendente = () => pedido({ status: "pendente", expira_em: "2026-10-30T12:30:00Z" });
const pag = (v: number): Tables<"pagamentos"> => ({
  caixa_id: null,
  comanda_id: "c",
  criado_em: "",
  estabelecimento_id: "e",
  forma: "pix",
  id: "g" + v,
  observacao: null,
  recebido_centavos: null,
  troco_centavos: null,
  valor_centavos: v,
});
const comanda = (o: Partial<ComandaPainel>): ComandaPainel => ({
  aberta_em: "",
  cliente_nome: "Ana",
  estabelecimento_id: "e",
  fechada_em: null,
  id: "c",
  mesa_id: "m",
  mesa_numero: 1,
  sessao_id: "s",
  status: "aberta",
  pedidos: [],
  pagamentos: [],
  ...o,
});
const brl = (c: number) => `R$ ${(c / 100).toFixed(2)}`;

describe("conta", () => {
  it("devido: só confirmados e sem itens cancelados", () => {
    const c = comanda({
      pedidos: [
        pedido({
          itens: [
            item({ subtotal_centavos: 1000 }),
            item({ subtotal_centavos: 500, status: "cancelado" }),
            item({ subtotal_centavos: 200, status: "aguardando" }),
          ],
        }),
        pedido({ status: "pendente", itens: [item({ subtotal_centavos: 9999 })] }),
        pedido({ status: "rejeitado", itens: [item({ subtotal_centavos: 9999 })] }),
      ],
    });
    expect(devidoDaComanda(c)).toBe(1200);
  });
  it("impedimentos para fechar seguem a ordem do banco", () => {
    expect(impedimentoParaFechar(comanda({ pedidos: [pendente()] }), AGORA)).toBe(
      "pedidos_pendentes",
    );
    expect(
      impedimentoParaFechar(
        comanda({ pedidos: [pedido({ itens: [item({ status: "aguardando" })] })] }),
        AGORA,
      ),
    ).toBe("itens_nao_entregues");
    expect(impedimentoParaFechar(comanda({ pedidos: [pedido({})] }), AGORA)).toBe(
      "saldo_em_aberto",
    );
    expect(
      impedimentoParaFechar(comanda({ pedidos: [pedido({})], pagamentos: [pag(1000)] }), AGORA),
    ).toBeNull();
  });
  it("pedido pendente expirado não impede", () => {
    const expirado = pedido({
      status: "pendente",
      expira_em: "2026-10-30T11:30:00Z",
      itens: [item({})],
    });
    expect(impedimentoParaFechar(comanda({ pedidos: [expirado] }), AGORA)).toBeNull();
  });
  it("liberar mesa: comanda aberta sem pedido aprovado não impede", () => {
    const paga = comanda({ status: "paga", pedidos: [pedido({})] });
    expect(impedimentoParaLiberar([paga], AGORA)).toBeNull();
    expect(impedimentoParaLiberar([paga, comanda({})], AGORA)).toBeNull(); // curioso: só identificado
    expect(
      impedimentoParaLiberar(
        [paga, comanda({ pedidos: [pedido({ status: "rejeitado" })] })],
        AGORA,
      ),
    ).toBeNull();
    expect(
      impedimentoParaLiberar(
        [paga, comanda({ pedidos: [pedido({ itens: [item({ status: "entregue" })] })] })],
        AGORA,
      ),
    ).toBe("comandas_em_aberto"); // aprovado e ainda não pago
    expect(
      impedimentoParaLiberar([comanda({ status: "paga", pedidos: [pendente()] })], AGORA),
    ).toBe("pedidos_pendentes");
  });
  it("comanda aparece no painel só com pedido aprovado ou pendente válido", () => {
    expect(comandaTemAtividade(comanda({}), AGORA)).toBe(false);
    expect(
      comandaTemAtividade(comanda({ pedidos: [pedido({ status: "rejeitado" })] }), AGORA),
    ).toBe(false);
    expect(comandaTemAtividade(comanda({ pedidos: [pendente()] }), AGORA)).toBe(true);
    expect(
      comandaTemAtividade(
        comanda({ pedidos: [pedido({ status: "pendente", expira_em: "2026-10-30T11:30:00Z" })] }),
        AGORA,
      ),
    ).toBe(false);
    expect(comandaTemAtividade(comanda({ pedidos: [pedido({})] }), AGORA)).toBe(true);
  });
  it("situação da mesa: só ocupa depois de aprovar um pedido", () => {
    const sess = (status: "aberta" | "fechamento" | "encerrada", confirmada: boolean) => ({
      status,
      confirmada,
    });
    expect(situacaoDaMesa({ ativa: true }, undefined)).toBe("livre");
    expect(situacaoDaMesa({ ativa: false }, undefined)).toBe("inativa");
    expect(situacaoDaMesa({ ativa: true }, sess("aberta", false))).toBe("livre"); // só identificado
    expect(situacaoDaMesa({ ativa: true }, sess("aberta", true))).toBe("ocupada");
    expect(situacaoDaMesa({ ativa: false }, sess("fechamento", true))).toBe("fechamento");
    expect(situacaoDaMesa({ ativa: true }, sess("encerrada", true))).toBe("livre");
  });
});

describe("validarPagamento", () => {
  const base = { forma: "pix" as const, recebido: "", obs: "" };
  it("aceita valor até o saldo", () => {
    expect(validarPagamento({ ...base, valor: "10,00" }, 1000, brl)).toEqual({
      ok: true,
      valor: 1000,
      recebido: undefined,
      troco: 0,
    });
  });
  it("recusa zero, inválido e acima do saldo", () => {
    for (const v of ["0", "abc", ""])
      expect(validarPagamento({ ...base, valor: v }, 1000, brl).ok).toBe(false);
    const r = validarPagamento({ ...base, valor: "10,01" }, 1000, brl);
    expect(r.ok === false && r.erros.valor).toContain("R$ 10.00");
  });
  it("dinheiro: calcula o troco e recusa recebido menor", () => {
    expect(
      validarPagamento(
        { valor: "15,00", forma: "dinheiro", recebido: "20,00", obs: "" },
        2000,
        brl,
      ),
    ).toEqual({ ok: true, valor: 1500, recebido: 2000, troco: 500 });
    const r = validarPagamento(
      { valor: "15,00", forma: "dinheiro", recebido: "10,00", obs: "" },
      2000,
      brl,
    );
    expect(r.ok).toBe(false);
  });
  it("recebido só vale em dinheiro", () => {
    expect(
      validarPagamento({ valor: "5,00", forma: "pix", recebido: "999", obs: "" }, 500, brl),
    ).toMatchObject({ ok: true, recebido: undefined });
  });
});
