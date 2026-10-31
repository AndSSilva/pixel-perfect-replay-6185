import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, Landmark, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Campo, EmptyState, PageHeader, Painel, Selo, StatCard } from "@/components/app/common";
import { estadoDaConsulta } from "@/components/app/Consulta";
import { useEmpresa } from "@/lib/empresa/contexto";
import { centavosParaInput, formatBRL, formatDataHora } from "@/lib/format";
import {
  ROTULO_DIFERENCA,
  caixaAberto,
  situacaoDaDiferenca,
  validarValorCaixa,
  type CaixaRow,
} from "@/lib/pedidos/caixa";
import { rotuloForma } from "@/lib/pedidos/rotulos";
import {
  abrirCaixa,
  atualizarAtendimento,
  chaveCaixas,
  fecharCaixa,
  listarCaixas,
  listarMovimentosCaixa,
  movimentarCaixa,
  obterResumoCaixa,
} from "@/lib/pedidos/servico-painel";
import { ErroPedido, mensagemDoErroPedido } from "@/lib/pedidos/tipos";

export const Route = createFileRoute("/admin/contas/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa — Mesa Digital" },
      { name: "description", content: "Abertura, movimentos e fechamento do caixa." },
    ],
  }),
  component: PaginaCaixa,
});

const FORMAS = ["dinheiro", "pix", "debito", "credito", "outro"] as const;

function PaginaCaixa() {
  const empresa = useEmpresa();
  const caixas = useQuery({
    queryKey: chaveCaixas(empresa.id),
    queryFn: () => listarCaixas(empresa.id),
    refetchInterval: 15_000,
  });
  const pronto = estadoDaConsulta(caixas);
  const aberto = caixas.data ? caixaAberto(caixas.data) : undefined;
  const fechados = (caixas.data ?? []).filter((c) => c.status === "fechado");

  return (
    <>
      <Link
        to="/admin/contas"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Contas e pagamentos
      </Link>
      <PageHeader
        titulo="Caixa"
        descricao="Abra o caixa para receber pagamentos e feche no fim do expediente conferindo o dinheiro."
        acoes={aberto ? <Selo tom="sucesso">Aberto</Selo> : <Selo tom="neutro">Fechado</Selo>}
      />
      {pronto ?? (
        <div className="space-y-6">
          {aberto ? (
            <CaixaAberto caixa={aberto} empresaId={empresa.id} />
          ) : (
            <AbrirCaixa empresaId={empresa.id} />
          )}
          <Painel titulo="Caixas anteriores">
            {fechados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum caixa fechado ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="pb-2 font-medium">Aberto em</th>
                      <th className="pb-2 font-medium">Fechado em</th>
                      <th className="pb-2 text-right font-medium">Abertura</th>
                      <th className="pb-2 text-right font-medium">Esperado</th>
                      <th className="pb-2 text-right font-medium">Contado</th>
                      <th className="pb-2 text-right font-medium">Diferença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {fechados.map((c) => (
                      <LinhaFechado key={c.id} c={c} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>
        </div>
      )}
    </>
  );
}

function LinhaFechado({ c }: { c: CaixaRow }) {
  const dif = c.diferenca_centavos ?? 0;
  const situacao = situacaoDaDiferenca(dif);
  return (
    <tr title={c.observacao_fechamento ?? undefined}>
      <td className="py-2.5 whitespace-nowrap">{formatDataHora(c.aberto_em)}</td>
      <td className="py-2.5 whitespace-nowrap">{formatDataHora(c.fechado_em)}</td>
      <td className="py-2.5 text-right tabular-nums">{formatBRL(c.abertura_centavos)}</td>
      <td className="py-2.5 text-right tabular-nums">{formatBRL(c.esperado_centavos ?? 0)}</td>
      <td className="py-2.5 text-right tabular-nums">{formatBRL(c.contado_centavos ?? 0)}</td>
      <td
        className={`py-2.5 text-right tabular-nums ${situacao === "falta" ? "text-destructive" : situacao === "sobra" ? "text-warning" : ""}`}
      >
        {dif > 0 ? "+" : ""}
        {formatBRL(dif)}
      </td>
    </tr>
  );
}

function useAcao(empresaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fn }: { fn: () => Promise<unknown>; ok: string }) => fn(),
    onSuccess: (_r, v) => {
      toast.success(v.ok);
      atualizarAtendimento(qc, empresaId);
    },
    onError: (e) => {
      const det =
        e instanceof ErroPedido && e.codigo === "valor_excede_caixa" && e.detalhe
          ? { description: `Dinheiro esperado no caixa: ${formatBRL(Number(e.detalhe))}` }
          : undefined;
      toast.error(mensagemDoErroPedido(e), det);
      atualizarAtendimento(qc, empresaId);
    },
  });
}

function AbrirCaixa({ empresaId }: { empresaId: string }) {
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string>();
  const acao = useAcao(empresaId);
  return (
    <Painel titulo="Abrir caixa">
      <EmptyState
        icone={Lock}
        titulo="O caixa está fechado"
        texto="Enquanto estiver fechado, não é possível registrar pagamentos. Informe quanto há em dinheiro na gaveta para abrir."
      />
      <form
        className="mx-auto mt-4 max-w-sm space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const v = validarValorCaixa(valor, { permitirZero: true });
          if (!v.ok) return setErro(v.erro);
          setErro(undefined);
          void acao
            .mutateAsync({ fn: () => abrirCaixa(empresaId, v.centavos), ok: "Caixa aberto." })
            .catch(() => undefined);
        }}
      >
        <Campo
          id="abertura"
          rotulo="Valor de abertura (R$)"
          erro={erro}
          dica="Dinheiro na gaveta ao abrir. Pode ser 0,00."
        >
          <Input
            id="abertura"
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </Campo>
        <Button type="submit" className="w-full" disabled={acao.isPending}>
          <Landmark className="h-4 w-4" /> Abrir caixa
        </Button>
      </form>
    </Painel>
  );
}

function CaixaAberto({ caixa, empresaId }: { caixa: CaixaRow; empresaId: string }) {
  const resumo = useQuery({
    queryKey: [...chaveCaixas(empresaId), caixa.id, "resumo"],
    queryFn: () => obterResumoCaixa(caixa.id),
    refetchInterval: 10_000,
  });
  const movimentos = useQuery({
    queryKey: [...chaveCaixas(empresaId), caixa.id, "movimentos"],
    queryFn: () => listarMovimentosCaixa(caixa.id),
    refetchInterval: 15_000,
  });
  const pronto = estadoDaConsulta(resumo) ?? estadoDaConsulta(movimentos);
  if (pronto) return pronto;
  const r = resumo.data!;
  return (
    <>
      <p className="text-sm text-muted-foreground">Aberto em {formatDataHora(caixa.aberto_em)}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard rotulo="Abertura" valor={formatBRL(r.abertura_centavos)} icone={Landmark} />
        <StatCard
          rotulo="Dinheiro recebido"
          valor={formatBRL(r.dinheiro_centavos)}
          icone={ArrowDownCircle}
        />
        <StatCard
          rotulo="Reforços − sangrias"
          valor={formatBRL(r.reforcos_centavos - r.sangrias_centavos)}
          icone={ArrowUpCircle}
        />
        <StatCard
          rotulo="Dinheiro esperado"
          valor={formatBRL(r.esperado_centavos)}
          icone={Landmark}
          destaque
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Painel titulo="Recebido por forma de pagamento">
          <ul className="divide-y text-sm">
            {FORMAS.map((f) => (
              <li key={f} className="flex justify-between py-2">
                <span>{rotuloForma[f]}</span>
                <span className="tabular-nums">{formatBRL(r.por_forma[f] ?? 0)}</span>
              </li>
            ))}
            <li className="flex justify-between py-2 font-semibold">
              <span>Total ({r.qtd_pagamentos} pagamento(s))</span>
              <span className="tabular-nums">{formatBRL(r.total_recebido_centavos)}</span>
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Só o dinheiro entra na conferência da gaveta. O troco nunca é contado como recebido.
          </p>
        </Painel>

        <Painel
          titulo="Sangrias e reforços"
          acao={
            <div className="flex gap-2">
              <MovimentoDialog empresaId={empresaId} caixaId={caixa.id} tipo="reforco" />
              <MovimentoDialog empresaId={empresaId} caixaId={caixa.id} tipo="sangria" />
            </div>
          }
        >
          {(movimentos.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum movimento neste caixa.</p>
          ) : (
            <ul className="divide-y text-sm">
              {(movimentos.data ?? []).map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">{m.tipo === "sangria" ? "Sangria" : "Reforço"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDataHora(m.criado_em)} · {m.motivo}
                    </p>
                  </div>
                  <span
                    className={`tabular-nums ${m.tipo === "sangria" ? "text-destructive" : ""}`}
                  >
                    {m.tipo === "sangria" ? "−" : "+"} {formatBRL(m.valor_centavos)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      <FecharCaixaDialog empresaId={empresaId} caixaId={caixa.id} esperado={r.esperado_centavos} />
    </>
  );
}

function MovimentoDialog({
  empresaId,
  caixaId,
  tipo,
}: {
  empresaId: string;
  caixaId: string;
  tipo: "sangria" | "reforco";
}) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<{ valor?: string; motivo?: string }>({});
  const acao = useAcao(empresaId);
  const nome = tipo === "sangria" ? "Sangria" : "Reforço";
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
        {nome}
      </Button>
      <Dialog
        open={aberto}
        onOpenChange={(o) => {
          setAberto(o);
          if (!o) {
            setValor("");
            setMotivo("");
            setErros({});
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{nome} de caixa</DialogTitle>
            <DialogDescription>
              {tipo === "sangria"
                ? "Retirada de dinheiro da gaveta (por exemplo, pagamento de fornecedor)."
                : "Entrada de dinheiro na gaveta (por exemplo, troco trazido do banco)."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const v = validarValorCaixa(valor, { permitirZero: false });
              const novos: typeof erros = {};
              if (!v.ok) novos.valor = v.erro;
              if (!motivo.trim()) novos.motivo = "Informe o motivo.";
              setErros(novos);
              if (!v.ok || novos.motivo) return;
              void acao
                .mutateAsync({
                  fn: () => movimentarCaixa({ caixaId, tipo, valorCentavos: v.centavos, motivo }),
                  ok: tipo === "sangria" ? "Sangria registrada." : "Reforço registrado.",
                })
                .then(() => setAberto(false))
                .catch(() => undefined);
            }}
          >
            <Campo id={`mv-valor-${tipo}`} rotulo="Valor (R$)" erro={erros.valor}>
              <Input
                id={`mv-valor-${tipo}`}
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </Campo>
            <Campo id={`mv-motivo-${tipo}`} rotulo="Motivo" erro={erros.motivo}>
              <Textarea
                id={`mv-motivo-${tipo}`}
                value={motivo}
                maxLength={200}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </Campo>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAberto(false)}>
                Voltar
              </Button>
              <Button type="submit" disabled={acao.isPending}>
                Registrar {nome.toLowerCase()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FecharCaixaDialog({
  empresaId,
  caixaId,
  esperado,
}: {
  empresaId: string;
  caixaId: string;
  esperado: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [contado, setContado] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string>();
  const acao = useAcao(empresaId);
  const v = validarValorCaixa(contado, { permitirZero: true });
  const dif = v.ok ? v.centavos - esperado : null;
  return (
    <div className="flex justify-end">
      <Button onClick={() => setAberto(true)}>
        <Lock className="h-4 w-4" /> Fechar caixa
      </Button>
      <Dialog
        open={aberto}
        onOpenChange={(o) => {
          setAberto(o);
          if (!o) {
            setContado("");
            setObs("");
            setErro(undefined);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar caixa</DialogTitle>
            <DialogDescription>
              Conte o dinheiro da gaveta e informe o valor. Depois de fechado, o caixa não pode ser
              alterado e novos pagamentos exigem abrir outro caixa.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!v.ok) return setErro(v.erro);
              setErro(undefined);
              void acao
                .mutateAsync({
                  fn: () => fecharCaixa(caixaId, v.centavos, obs),
                  ok: "Caixa fechado.",
                })
                .then(() => setAberto(false))
                .catch(() => undefined);
            }}
          >
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              Dinheiro esperado: <strong className="tabular-nums">{formatBRL(esperado)}</strong>
            </p>
            <Campo id="contado" rotulo="Dinheiro contado (R$)" erro={erro}>
              <div className="flex gap-2">
                <Input
                  id="contado"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={contado}
                  onChange={(e) => setContado(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setContado(centavosParaInput(esperado))}
                >
                  Igual ao esperado
                </Button>
              </div>
            </Campo>
            {dif !== null ? (
              <p
                className={`rounded-md px-3 py-2 text-sm ${dif === 0 ? "bg-success/10" : dif < 0 ? "bg-destructive/10" : "bg-warning/10"}`}
                aria-live="polite"
              >
                {ROTULO_DIFERENCA[situacaoDaDiferenca(dif)]}
                {dif !== 0 ? `: ${dif > 0 ? "+" : "−"} ${formatBRL(Math.abs(dif))}` : ""}
              </p>
            ) : null}
            <Campo id="obs-fechamento" rotulo="Observação (opcional)">
              <Textarea
                id="obs-fechamento"
                value={obs}
                maxLength={200}
                onChange={(e) => setObs(e.target.value)}
              />
            </Campo>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAberto(false)}>
                Voltar
              </Button>
              <Button type="submit" disabled={acao.isPending}>
                Fechar caixa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
