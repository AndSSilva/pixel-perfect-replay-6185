import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCheck, Printer, Unlock, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Confirmar, EmptyState, PageHeader, Painel, Selo } from "@/components/app/common";
import { estadoDaConsulta } from "@/components/app/Consulta";
import { useEmpresa } from "@/lib/empresa/contexto";
import { chaveMesas, listarMesas } from "@/lib/catalogo/servico";
import { caminhoMesa, rotuloMesa } from "@/lib/catalogo/mesas";
import { formatBRL, formatDataHora } from "@/lib/format";
import {
  comandaTemAtividade,
  devidoDaComanda,
  impedimentoParaLiberar,
  pagoDaComanda,
  pedidosPendentesDaComanda,
  saldoDaComanda,
  situacaoDaMesa,
} from "@/lib/pedidos/contas";
import {
  atualizarAtendimento,
  chaveComandas,
  chaveSessoes,
  iniciarFechamentoMesa,
  liberarMesa,
  listarComandasAtivas,
  listarSessoesAtivas,
  retomarAtendimentoMesa,
} from "@/lib/pedidos/servico-painel";
import { MENSAGENS_PEDIDO, mensagemDoErroPedido } from "@/lib/pedidos/tipos";

export const Route = createFileRoute("/admin/mesas/$mesaId")({
  head: () => ({
    meta: [
      { title: "Atendimento da mesa — Mesa Digital" },
      { name: "description", content: "Contas individuais, consumo e fechamento da mesa." },
    ],
  }),
  component: MesaDetalhe,
});

const SELO = {
  livre: ["sucesso", "Livre"],
  ocupada: ["destaque", "Ocupada"],
  fechamento: ["alerta", "Em fechamento"],
  inativa: ["neutro", "Desativada"],
} as const;

function MesaDetalhe() {
  const { mesaId } = Route.useParams();
  const empresa = useEmpresa();
  const qc = useQueryClient();
  const mesas = useQuery({
    queryKey: chaveMesas(empresa.id),
    queryFn: () => listarMesas(empresa.id),
  });
  const sessoes = useQuery({
    queryKey: chaveSessoes(empresa.id),
    queryFn: () => listarSessoesAtivas(empresa.id),
    refetchInterval: 10_000,
  });
  const comandas = useQuery({
    queryKey: chaveComandas(empresa.id),
    queryFn: () => listarComandasAtivas(empresa.id),
    refetchInterval: 10_000,
  });
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

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
  const exec = (fn: () => Promise<unknown>, ok: string) =>
    void rodar.mutateAsync({ fn, ok }).catch(() => undefined);

  const pronto = estadoDaConsulta(mesas) ?? estadoDaConsulta(sessoes) ?? estadoDaConsulta(comandas);
  if (pronto) return pronto;
  const mesa = mesas.data?.find((m) => m.id === mesaId);
  if (!mesa) {
    return (
      <EmptyState
        icone={ArrowLeft}
        titulo="Mesa não encontrada"
        acao={
          <Button asChild variant="secondary">
            <Link to="/admin/mesas">Voltar às mesas</Link>
          </Button>
        }
      />
    );
  }

  const sessao = sessoes.data?.find((s) => s.mesa_id === mesa.id);
  const contas = (comandas.data ?? []).filter(
    (c) => c.sessao_id === sessao?.id && comandaTemAtividade(c, agora),
  );
  // Só vira atendimento de verdade depois que o primeiro pedido é aprovado.
  const emAtendimento = sessao?.confirmada === true;
  const aguardando = sessao !== undefined && !emAtendimento;
  const [tom, rotulo] = SELO[situacaoDaMesa(mesa, sessao)];
  const consumo = contas.reduce((s, c) => s + devidoDaComanda(c), 0);
  const pago = contas.reduce((s, c) => s + pagoDaComanda(c), 0);
  const impedimento = sessao && emAtendimento ? impedimentoParaLiberar(contas, agora) : null;

  return (
    <>
      <Link
        to="/admin/mesas"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Mesas
      </Link>
      <PageHeader
        titulo={rotuloMesa(mesa.numero)}
        descricao={
          emAtendimento
            ? `Atendimento aberto em ${formatDataHora(sessao.aberta_em)}`
            : aguardando
              ? "Há cliente identificado, mas a mesa só fica ocupada quando você aprovar o primeiro pedido."
              : "Sem atendimento em andamento"
        }
        acoes={
          <>
            <Selo tom={tom}>{rotulo}</Selo>
            {emAtendimento && sessao?.status === "aberta" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={rodar.isPending}
                onClick={() =>
                  exec(
                    () => iniciarFechamentoMesa(mesa.id),
                    "Mesa em fechamento. Novos pedidos ficam bloqueados.",
                  )
                }
              >
                <ClipboardCheck className="h-4 w-4" /> Iniciar fechamento
              </Button>
            ) : null}
            {emAtendimento && sessao?.status === "fechamento" ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={rodar.isPending}
                onClick={() => exec(() => retomarAtendimentoMesa(mesa.id), "Atendimento retomado.")}
              >
                <Undo2 className="h-4 w-4" /> Retomar atendimento
              </Button>
            ) : null}
            {emAtendimento ? (
              <Confirmar
                gatilho={
                  <Button size="sm" disabled={impedimento !== null || rodar.isPending}>
                    <Unlock className="h-4 w-4" /> Liberar mesa
                  </Button>
                }
                titulo={`Liberar ${rotuloMesa(mesa.numero)}?`}
                descricao="O atendimento será encerrado e a mesa fica livre para novos clientes."
                rotuloAcao="Liberar mesa"
                onConfirmar={() => exec(() => liberarMesa(mesa.id), "Mesa liberada.")}
              />
            ) : null}
          </>
        }
      />
      {impedimento ? (
        <p className="mb-4 text-sm text-muted-foreground">{MENSAGENS_PEDIDO[impedimento]}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["Consumo confirmado", consumo],
                ["Pago", pago],
                ["Saldo em aberto", consumo - pago],
              ] as const
            ).map(([r, v]) => (
              <div key={r} className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">{r}</p>
                <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                  {formatBRL(v)}
                </p>
              </div>
            ))}
          </div>

          <Painel titulo="Contas individuais">
            {contas.length === 0 ? (
              <EmptyState
                icone={ClipboardCheck}
                titulo="Nenhum cliente identificado"
                texto="Quando alguém acessar o cardápio desta mesa e se identificar, a conta aparecerá aqui."
              />
            ) : (
              <ul className="space-y-2">
                {contas.map((c) => {
                  const pend = pedidosPendentesDaComanda(c, agora).length;
                  return (
                    <li key={c.id}>
                      <Link
                        to="/admin/contas/$contaId"
                        params={{ contaId: c.id }}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 hover:border-primary/40"
                      >
                        <div>
                          <p className="font-medium">{c.cliente_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            Consumo {formatBRL(devidoDaComanda(c))} · Pago{" "}
                            {formatBRL(pagoDaComanda(c))}
                            {pend > 0 ? (
                              <span className="text-warning"> · {pend} pendente(s)</span>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatBRL(saldoDaComanda(c))}
                          </span>
                          {c.status === "paga" ? (
                            <Selo tom="sucesso">Paga</Selo>
                          ) : (
                            <Selo tom="info">Aberta</Selo>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Painel>
          <p className="text-xs text-muted-foreground">
            Pedidos pendentes e entregas ficam em{" "}
            <Link to="/admin/pedidos" className="text-link underline">
              Pedidos
            </Link>
            .
          </p>
        </div>

        <Painel titulo="QR Code da mesa" className="h-fit">
          <p className="break-all text-xs text-muted-foreground">
            {caminhoMesa(empresa.slug, mesa.numero)}
          </p>
          <Button asChild size="sm" variant="secondary" className="mt-3 w-full">
            <Link to="/admin/imprimir/$mesaId" params={{ mesaId: mesa.id }}>
              <Printer className="h-4 w-4" /> Cartaz com QR Code
            </Link>
          </Button>
        </Painel>
      </div>
    </>
  );
}
