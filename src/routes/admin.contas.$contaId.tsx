import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Campo, Confirmar, EmptyState, PageHeader, Painel, Selo } from "@/components/app/common";
import { estadoDaConsulta } from "@/components/app/Consulta";
import { useEmpresa } from "@/lib/empresa/contexto";
import { centavosParaInput, formatBRL, formatDataHora } from "@/lib/format";
import {
  ROTULO_IMPEDIMENTO,
  devidoDaComanda,
  impedimentoParaFechar,
  pagoDaComanda,
  pedidosPendentesDaComanda,
  saldoDaComanda,
  validarPagamento,
  type ErrosPagamento,
} from "@/lib/pedidos/contas";
import { caixaAberto } from "@/lib/pedidos/caixa";
import { rotuloForma, rotuloItem } from "@/lib/pedidos/rotulos";
import {
  atualizarAtendimento,
  chaveCaixas,
  chaveComandas,
  excluirPagamento,
  fecharComanda,
  listarCaixas,
  obterComanda,
  registrarPagamento,
} from "@/lib/pedidos/servico-painel";
import { mensagemDoErroPedido } from "@/lib/pedidos/tipos";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/contas/$contaId")({
  head: () => ({
    meta: [
      { title: "Conta individual — Mesa Digital" },
      { name: "description", content: "Conferência de itens, pagamentos e fechamento da conta." },
    ],
  }),
  component: ContaDetalhe,
});

const FORMAS: Tables<"pagamentos">["forma"][] = ["pix", "dinheiro", "debito", "credito", "outro"];

function ContaDetalhe() {
  const { contaId } = Route.useParams();
  const empresa = useEmpresa();
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: [...chaveComandas(empresa.id), contaId],
    queryFn: () => obterComanda(empresa.id, contaId),
    refetchInterval: 10_000,
  });
  const caixas = useQuery({
    queryKey: chaveCaixas(empresa.id),
    queryFn: () => listarCaixas(empresa.id),
    refetchInterval: 15_000,
  });
  const semCaixa = caixas.isSuccess && !caixaAberto(caixas.data);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<Tables<"pagamentos">["forma"]>("pix");
  const [recebido, setRecebido] = useState("");
  const [obs, setObs] = useState("");
  const [erros, setErros] = useState<ErrosPagamento>({});

  const rodar = useMutation({
    mutationFn: ({ fn }: { fn: () => Promise<unknown>; ok: string }) => fn(),
    onSuccess: (_r, v) => {
      toast.success(v.ok);
      atualizarAtendimento(qc, empresa.id);
    },
    onError: (e) => {
      toast.error(mensagemDoErroPedido(e));
      atualizarAtendimento(qc, empresa.id);
    },
  });

  const estado = estadoDaConsulta(consulta);
  if (estado) return estado;
  const conta = consulta.data;
  if (!conta) {
    return (
      <EmptyState
        icone={ArrowLeft}
        titulo="Conta não encontrada"
        acao={
          <Button asChild variant="secondary">
            <Link to="/admin/contas">Voltar</Link>
          </Button>
        }
      />
    );
  }

  const aberta = conta.status === "aberta";
  const total = devidoDaComanda(conta);
  const pago = pagoDaComanda(conta);
  const saldo = saldoDaComanda(conta);
  const pendentes = pedidosPendentesDaComanda(conta, agora);
  const impedimento = impedimentoParaFechar(conta, agora);
  const confirmados = conta.pedidos.filter((p) => p.status === "confirmado");
  const previa = validarPagamento({ valor, forma, recebido, obs }, saldo, formatBRL);
  const troco = previa.ok ? previa.troco : 0;

  const registrar = async () => {
    const v = validarPagamento({ valor, forma, recebido, obs }, saldo, formatBRL);
    if (!v.ok) {
      setErros(v.erros);
      return;
    }
    setErros({});
    try {
      await rodar.mutateAsync({
        fn: () =>
          registrarPagamento({
            comandaId: conta.id,
            valorCentavos: v.valor,
            forma,
            observacao: obs,
            recebidoCentavos: v.recebido,
          }),
        ok:
          v.troco > 0
            ? `Pagamento registrado. Troco: ${formatBRL(v.troco)}`
            : "Pagamento registrado.",
      });
      setValor("");
      setRecebido("");
      setObs("");
    } catch {
      /* o toast de erro já foi mostrado */
    }
  };

  return (
    <>
      <Link
        to="/admin/mesas/$mesaId"
        params={{ mesaId: conta.mesa_id }}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Mesa {conta.mesa_numero}
      </Link>
      <PageHeader
        titulo={conta.cliente_nome}
        descricao={`Mesa ${conta.mesa_numero} · aberta em ${formatDataHora(conta.aberta_em)}${conta.fechada_em ? ` · fechada em ${formatDataHora(conta.fechada_em)}` : ""}`}
        acoes={aberta ? <Selo tom="info">Aberta</Selo> : <Selo tom="sucesso">Paga</Selo>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {pendentes.length > 0 ? (
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm">
              <p className="font-medium text-warning">
                {pendentes.length} pedido(s) pendente(s) de confirmação
              </p>
              <p className="mt-1 text-muted-foreground">
                Não estão incluídos no consumo abaixo. Confirme ou rejeite na{" "}
                <Link to="/admin/pedidos" className="text-link underline">
                  fila de pedidos
                </Link>
                .
              </p>
            </div>
          ) : null}

          <Painel titulo="Itens confirmados">
            {confirmados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item confirmado nesta conta.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-medium">Produto</th>
                      <th className="pb-2 text-right font-medium">Qtd.</th>
                      <th className="pb-2 text-right font-medium">Unitário</th>
                      <th className="pb-2 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {confirmados.flatMap((p) =>
                      p.itens.map((i) => (
                        <tr
                          key={i.id}
                          className={i.status === "cancelado" ? "text-muted-foreground" : ""}
                        >
                          <td className="py-2">
                            <span className={i.status === "cancelado" ? "line-through" : ""}>
                              {i.nome_produto}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {formatDataHora(p.confirmado_em)} · {rotuloItem[i.status]}
                              {i.motivo_cancelamento ? ` (${i.motivo_cancelamento})` : ""}
                            </span>
                          </td>
                          <td className="py-2 text-right tabular-nums">{i.quantidade}</td>
                          <td className="py-2 text-right tabular-nums">
                            {formatBRL(i.preco_unitario_centavos)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {i.status === "cancelado" ? "—" : formatBRL(i.subtotal_centavos)}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <dl className="mt-4 space-y-1 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total confirmado</dt>
                <dd className="tabular-nums">{formatBRL(total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Pagamentos</dt>
                <dd className="tabular-nums">− {formatBRL(pago)}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <dt>Saldo restante</dt>
                <dd className="tabular-nums text-link">{formatBRL(saldo)}</dd>
              </div>
            </dl>
          </Painel>

          <Painel titulo="Pagamentos registrados">
            {conta.pagamentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
            ) : (
              <ul className="divide-y text-sm">
                {conta.pagamentos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-medium">{rotuloForma[p.forma]}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDataHora(p.criado_em)}
                        {p.troco_centavos && p.recebido_centavos
                          ? ` · recebido ${formatBRL(p.recebido_centavos)}, troco ${formatBRL(p.troco_centavos)}`
                          : ""}
                        {p.observacao ? ` · ${p.observacao}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium tabular-nums">
                        {formatBRL(p.valor_centavos)}
                      </span>
                      {aberta ? (
                        <Confirmar
                          gatilho={
                            <Button size="icon" variant="ghost" aria-label="Remover pagamento">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          }
                          titulo="Remover pagamento?"
                          descricao="Use para corrigir um lançamento incorreto."
                          rotuloAcao="Remover"
                          perigo
                          onConfirmar={() =>
                            void rodar
                              .mutateAsync({
                                fn: () => excluirPagamento(p.id),
                                ok: "Pagamento removido.",
                              })
                              .catch(() => undefined)
                          }
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </div>

        {aberta ? (
          <div className="space-y-4">
            <Painel titulo="Registrar pagamento">
              {semCaixa ? (
                <p className="mb-4 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-warning">
                  O caixa está fechado.{" "}
                  <Link to="/admin/contas/caixa" className="underline">
                    Abra o caixa
                  </Link>{" "}
                  para registrar pagamentos.
                </p>
              ) : null}
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void registrar();
                }}
              >
                <Campo id="forma" rotulo="Forma de pagamento">
                  <Select value={forma} onValueChange={(f) => setForma(f as typeof forma)}>
                    <SelectTrigger id="forma">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {rotuloForma[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
                <Campo id="valor" rotulo="Valor a abater (R$)" erro={erros.valor}>
                  <div className="flex gap-2">
                    <Input
                      id="valor"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      aria-invalid={!!erros.valor}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setValor(centavosParaInput(saldo))}
                      disabled={saldo <= 0}
                    >
                      Saldo
                    </Button>
                  </div>
                </Campo>
                {forma === "dinheiro" ? (
                  <Campo
                    id="recebido"
                    rotulo="Valor recebido (opcional)"
                    erro={erros.recebido}
                    dica="Para calcular o troco. O troco não entra como receita."
                  >
                    <Input
                      id="recebido"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={recebido}
                      onChange={(e) => setRecebido(e.target.value)}
                    />
                  </Campo>
                ) : null}
                {troco > 0 ? (
                  <p className="rounded-md bg-primary/10 px-3 py-2 text-sm">
                    Troco: <strong className="tabular-nums">{formatBRL(troco)}</strong>
                  </p>
                ) : null}
                <Campo id="obs" rotulo="Observação (opcional)" erro={erros.obs}>
                  <Input
                    id="obs"
                    value={obs}
                    maxLength={200}
                    onChange={(e) => setObs(e.target.value)}
                  />
                </Campo>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={saldo <= 0 || rodar.isPending || semCaixa}
                >
                  Registrar pagamento
                </Button>
              </form>
            </Painel>
            <Confirmar
              gatilho={
                <Button
                  className="w-full"
                  variant={impedimento === null ? "default" : "secondary"}
                  disabled={impedimento !== null || rodar.isPending}
                >
                  <CheckCircle2 className="h-4 w-4" /> Fechar conta
                </Button>
              }
              titulo="Fechar esta conta?"
              descricao={`A conta de ${conta.cliente_nome} será marcada como paga (${formatBRL(total)}).`}
              rotuloAcao="Fechar conta"
              onConfirmar={() =>
                void rodar
                  .mutateAsync({ fn: () => fecharComanda(conta.id), ok: "Conta fechada." })
                  .catch(() => undefined)
              }
            />
            {impedimento ? (
              <p className="text-center text-xs text-muted-foreground">
                {ROTULO_IMPEDIMENTO[impedimento]}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
