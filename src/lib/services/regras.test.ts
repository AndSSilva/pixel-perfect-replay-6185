import { describe, expect, it } from "vitest";
import { criarDadosDemo } from "../seed";
import type { AppData } from "../types";
import * as R from "./regras";

function cenario() {
  const d: AppData = criarDadosDemo();
  const mesa = d.mesas.find((m) => !m.sessaoAtualId)!;
  const produto = d.produtos.find((p) => p.disponivel)!;
  produto.precoCentavos = 1000;
  return { d, mesa, produto };
}

describe("regras de negócio", () => {
  it("novo pedido entra como pendente e não conta no saldo", () => {
    const { d, mesa, produto } = cenario();
    const conta = R.identificarCliente(d, mesa.id, "Ana");
    const pid = R.enviarPedido(d, conta, [{ produtoId: produto.id, quantidade: 2 }]);
    expect(d.pedidos.find((p) => p.id === pid)!.status).toBe("pendente");
    expect(R.saldoConta(d, conta)).toBe(0);
    R.confirmarPedido(d, pid);
    expect(R.saldoConta(d, conta)).toBe(2000);
  });

  it("pedido rejeitado não entra no saldo", () => {
    const { d, mesa, produto } = cenario();
    const conta = R.identificarCliente(d, mesa.id, "Ana");
    const pid = R.enviarPedido(d, conta, [{ produtoId: produto.id, quantidade: 1 }]);
    R.rejeitarPedido(d, pid, "falta");
    expect(R.saldoConta(d, conta)).toBe(0);
  });

  it("preserva o preço do momento do envio", () => {
    const { d, mesa, produto } = cenario();
    const conta = R.identificarCliente(d, mesa.id, "Ana");
    const pid = R.enviarPedido(d, conta, [{ produtoId: produto.id, quantidade: 1 }]);
    produto.precoCentavos = 9999;
    R.confirmarPedido(d, pid);
    expect(R.totalConfirmadoConta(d, conta)).toBe(1000);
  });

  it("rejeita quantidade não inteira ou produto indisponível", () => {
    const { d, mesa, produto } = cenario();
    const conta = R.identificarCliente(d, mesa.id, "Ana");
    expect(() => R.enviarPedido(d, conta, [{ produtoId: produto.id, quantidade: 1.5 }])).toThrow();
    produto.disponivel = false;
    expect(() => R.enviarPedido(d, conta, [{ produtoId: produto.id, quantidade: 1 }])).toThrow();
  });

  it("pagamentos parciais e múltiplos; não pode exceder o saldo", () => {
    const { d, mesa, produto } = cenario();
    const conta = R.identificarCliente(d, mesa.id, "Ana");
    R.confirmarPedido(d, R.enviarPedido(d, conta, [{ produtoId: produto.id, quantidade: 10 }])); // R$ 100
    R.registrarPagamento(d, { contaId: conta, valorCentavos: 4000, forma: "pix" });
    expect(() => R.fecharConta(d, conta)).toThrow();
    expect(() => R.registrarPagamento(d, { contaId: conta, valorCentavos: 6001, forma: "dinheiro" })).toThrow();
    R.registrarPagamento(d, { contaId: conta, valorCentavos: 6000, forma: "dinheiro", recebidoCentavos: 10000 });
    expect(d.pagamentos.at(-1)!.trocoCentavos).toBe(4000);
    expect(R.totalPagoConta(d, conta)).toBe(10000);
    R.fecharConta(d, conta);
    expect(d.contas.find((c) => c.id === conta)!.status).toBe("paga");
  });

  it("não aceita pagamento zero ou negativo", () => {
    const { d, mesa, produto } = cenario();
    const conta = R.identificarCliente(d, mesa.id, "Ana");
    R.confirmarPedido(d, R.enviarPedido(d, conta, [{ produtoId: produto.id, quantidade: 1 }]));
    expect(() => R.registrarPagamento(d, { contaId: conta, valorCentavos: 0, forma: "pix" })).toThrow();
    expect(() => R.registrarPagamento(d, { contaId: conta, valorCentavos: -100, forma: "pix" })).toThrow();
  });

  it("mesa só é liberada sem contas abertas nem pedidos pendentes", () => {
    const { d, mesa, produto } = cenario();
    const conta = R.identificarCliente(d, mesa.id, "Ana");
    const pid = R.enviarPedido(d, conta, [{ produtoId: produto.id, quantidade: 1 }]);
    expect(() => R.liberarMesa(d, mesa.id)).toThrow();
    R.confirmarPedido(d, pid);
    expect(() => R.liberarMesa(d, mesa.id)).toThrow();
    R.registrarPagamento(d, { contaId: conta, valorCentavos: 1000, forma: "credito" });
    R.fecharConta(d, conta);
    R.liberarMesa(d, mesa.id);
    expect(d.mesas.find((m) => m.id === mesa.id)!.sessaoAtualId).toBeNull();
  });

  it("não exclui mesa em atendimento", () => {
    const { d, mesa } = cenario();
    R.identificarCliente(d, mesa.id, "Ana");
    expect(() => R.excluirMesa(d, mesa.id)).toThrow();
  });

  it("nomes iguais criam contas separadas e não misturam consumo", () => {
    const { d, mesa, produto } = cenario();
    const a = R.identificarCliente(d, mesa.id, "Ana");
    const b = R.identificarCliente(d, mesa.id, "Ana");
    expect(a).not.toBe(b);
    R.confirmarPedido(d, R.enviarPedido(d, a, [{ produtoId: produto.id, quantidade: 1 }]));
    expect(R.totalConfirmadoConta(d, b)).toBe(0);
    expect(R.identificarCliente(d, mesa.id, "Ana", a)).toBe(a);
  });

  it("categoria com produtos só é excluída com reclassificação", () => {
    const { d, produto } = cenario();
    const origem = produto.categoriaId;
    const destino = d.categorias.find((c) => c.id !== origem)!.id;
    expect(() => R.excluirCategoria(d, origem)).toThrow();
    R.excluirCategoria(d, origem, destino);
    expect(d.produtos.find((p) => p.id === produto.id)!.categoriaId).toBe(destino);
  });
});
