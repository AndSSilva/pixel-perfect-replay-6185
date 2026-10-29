import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Campo, Confirmar, EmptyState, PageHeader, Painel, Selo } from "@/components/app/common";
import type { Erros } from "@/components/app/common";
import { executar, useDados } from "@/lib/store";
import { excluirPagamento, fecharConta, pedidosPendentesConta, registrarPagamento, saldoConta, totalConfirmadoConta, totalPagoConta } from "@/lib/services/regras";
import { centavosParaInput, formatBRL, formatDataHora, parseMoeda } from "@/lib/format";
import { FORMAS_PAGAMENTO, rotuloForma, type FormaPagamento } from "@/lib/types";

export const Route = createFileRoute("/admin/contas/$contaId")({
  head: () => ({
    meta: [
      { title: "Conta individual — Mesa Digital" },
      { name: "description", content: "Conferência de itens, pagamentos e fechamento da conta." },
      { property: "og:title", content: "Conta individual — Mesa Digital" },
      { property: "og:description", content: "Conferência de itens, pagamentos e fechamento da conta." },
    ],
  }),
  component: ContaDetalhe,
});

function ContaDetalhe() {
  const { contaId } = Route.useParams();
  const d = useDados()!;
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [recebido, setRecebido] = useState("");
  const [obs, setObs] = useState("");
  const [erros, setErros] = useState<Erros>({});

  const conta = d.contas.find((c) => c.id === contaId);
  if (!conta) return <EmptyState icone={ArrowLeft} titulo="Conta não encontrada" acao={<Button asChild variant="secondary"><Link to="/admin/contas">Voltar</Link></Button>} />;

  const confirmados = d.pedidos.filter((p) => p.contaId === conta.id && p.status === "confirmado");
  const pendentes = pedidosPendentesConta(d, conta.id);
  const pagamentos = d.pagamentos.filter((p) => p.contaId === conta.id).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  const total = totalConfirmadoConta(d, conta.id);
  const pago = totalPagoConta(d, conta.id);
  const saldo = saldoConta(d, conta.id);
  const aberta = conta.status === "aberta";

  const v = parseMoeda(valor);
  const rec = forma === "dinheiro" && recebido.trim() ? parseMoeda(recebido) : null;
  const troco = v !== null && rec !== null && rec >= v ? rec - v : null;

  const registrar = () => {
    const e: Erros = {};
    if (v === null || v <= 0) e.valor = "Informe um valor positivo.";
    else if (v > saldo) e.valor = `O valor não pode passar do saldo (${formatBRL(saldo)}).`;
    if (forma === "dinheiro" && recebido.trim()) {
      if (rec === null) e.recebido = "Valor inválido.";
      else if (v !== null && rec < v) e.recebido = "O valor recebido é menor que o pagamento.";
    }
    setErros(e);
    if (Object.keys(e).length) return;
    const r = executar(
      (x) => registrarPagamento(x, { contaId: conta.id, valorCentavos: v, forma, observacao: obs, recebidoCentavos: rec }),
      troco ? `Pagamento registrado. Troco: ${formatBRL(troco)}` : "Pagamento registrado.",
    );
    if (r.ok) { setValor(""); setRecebido(""); setObs(""); }
  };

  return (
    <>
      <Link to="/admin/mesas/$mesaId" params={{ mesaId: conta.mesaId }} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {conta.mesaNome}
      </Link>
      <PageHeader
        titulo={conta.clienteNome}
        descricao={`${conta.mesaNome} · aberta em ${formatDataHora(conta.abertaEm)}${conta.fechadaEm ? ` · fechada em ${formatDataHora(conta.fechadaEm)}` : ""}`}
        acoes={aberta ? <Selo tom="info">Aberta</Selo> : <Selo tom="sucesso">Paga</Selo>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {pendentes.length > 0 && (
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm">
              <p className="font-medium text-warning">{pendentes.length} pedido(s) pendente(s) de confirmação</p>
              <p className="mt-1 text-muted-foreground">Não estão incluídos no consumo abaixo. Confirme ou rejeite na <Link to="/admin/pedidos" className="text-link underline">fila de pedidos</Link>.</p>
            </div>
          )}
          <Painel titulo="Itens confirmados">
            {confirmados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item confirmado nesta conta.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr><th className="pb-2 font-medium">Produto</th><th className="pb-2 text-right font-medium">Qtd.</th><th className="pb-2 text-right font-medium">Unitário</th><th className="pb-2 text-right font-medium">Subtotal</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {confirmados.flatMap((p) =>
                      p.itens.map((i) => (
                        <tr key={p.id + i.produtoId}>
                          <td className="py-2">{i.nomeProduto}<span className="block text-xs text-muted-foreground">{formatDataHora(p.confirmadoEm)}</span></td>
                          <td className="py-2 text-right tabular">{i.quantidade}</td>
                          <td className="py-2 text-right tabular">{formatBRL(i.precoUnitarioCentavos)}</td>
                          <td className="py-2 text-right tabular">{formatBRL(i.subtotalCentavos)}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <dl className="mt-4 space-y-1 border-t pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Total confirmado</dt><dd className="tabular">{formatBRL(total)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Pagamentos</dt><dd className="tabular">− {formatBRL(pago)}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Saldo restante</dt><dd className="tabular text-link">{formatBRL(saldo)}</dd></div>
            </dl>
          </Painel>

          <Painel titulo="Pagamentos registrados">
            {pagamentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
            ) : (
              <ul className="divide-y text-sm">
                {pagamentos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-medium">{rotuloForma(p.formaPagamento)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDataHora(p.criadoEm)}
                        {p.trocoCentavos ? ` · recebido ${formatBRL(p.recebidoCentavos!)}, troco ${formatBRL(p.trocoCentavos)}` : ""}
                        {p.observacao && ` · ${p.observacao}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="tabular font-medium">{formatBRL(p.valorCentavos)}</span>
                      {aberta && (
                        <Confirmar
                          gatilho={<Button size="icon" variant="ghost" aria-label="Remover pagamento"><Trash2 className="h-4 w-4" /></Button>}
                          titulo="Remover pagamento?"
                          descricao="Use para corrigir um lançamento incorreto."
                          rotuloAcao="Remover"
                          perigo
                          onConfirmar={() => executar((x) => excluirPagamento(x, p.id), "Pagamento removido.")}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </div>

        {aberta && (
          <div className="space-y-4">
            <Painel titulo="Registrar pagamento">
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); registrar(); }}>
                <Campo id="forma" rotulo="Forma de pagamento">
                  <Select value={forma} onValueChange={(f) => setForma(f as FormaPagamento)}>
                    <SelectTrigger id="forma"><SelectValue /></SelectTrigger>
                    <SelectContent>{FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Campo>
                <Campo id="valor" rotulo="Valor a abater (R$)" erro={erros.valor}>
                  <div className="flex gap-2">
                    <Input id="valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} aria-invalid={!!erros.valor} />
                    <Button type="button" variant="secondary" onClick={() => setValor(centavosParaInput(saldo))} disabled={saldo === 0}>Saldo</Button>
                  </div>
                </Campo>
                {forma === "dinheiro" && (
                  <Campo id="recebido" rotulo="Valor recebido (opcional)" erro={erros.recebido} dica="Para calcular o troco. O troco não entra como receita.">
                    <Input id="recebido" inputMode="decimal" placeholder="0,00" value={recebido} onChange={(e) => setRecebido(e.target.value)} />
                  </Campo>
                )}
                {troco !== null && troco > 0 && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm">Troco: <strong className="tabular">{formatBRL(troco)}</strong></p>}
                <Campo id="obs" rotulo="Observação (opcional)">
                  <Input id="obs" value={obs} maxLength={120} onChange={(e) => setObs(e.target.value)} />
                </Campo>
                <Button type="submit" className="w-full" disabled={saldo === 0}>Registrar pagamento</Button>
              </form>
            </Painel>
            <Confirmar
              gatilho={
                <Button className="w-full" variant={saldo === 0 && pendentes.length === 0 ? "default" : "secondary"} disabled={saldo !== 0 || pendentes.length > 0}>
                  <CheckCircle2 className="h-4 w-4" /> Fechar conta
                </Button>
              }
              titulo="Fechar esta conta?"
              descricao={`A conta de ${conta.clienteNome} será marcada como paga (${formatBRL(total)}) e irá para o histórico.`}
              rotuloAcao="Fechar conta"
              onConfirmar={() => executar((x) => fecharConta(x, conta.id), "Conta fechada.")}
            />
            {(saldo !== 0 || pendentes.length > 0) && (
              <p className="text-center text-xs text-muted-foreground">A conta pode ser fechada quando o saldo for zero e não houver pedidos pendentes.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
