import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Landmark, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader, Selo } from "@/components/app/common";
import { estadoDaConsulta } from "@/components/app/Consulta";
import { useEmpresa } from "@/lib/empresa/contexto";
import { formatBRL, formatHora } from "@/lib/format";
import {
  comandaTemAtividade,
  devidoDaComanda,
  pagoDaComanda,
  pedidosPendentesDaComanda,
  saldoDaComanda,
} from "@/lib/pedidos/contas";
import { caixaAberto } from "@/lib/pedidos/caixa";
import {
  chaveCaixas,
  chaveComandas,
  listarCaixas,
  listarComandasAtivas,
} from "@/lib/pedidos/servico-painel";

export const Route = createFileRoute("/admin/contas/")({
  head: () => ({
    meta: [
      { title: "Contas e pagamentos — Mesa Digital" },
      { name: "description", content: "Contas individuais abertas e registro de pagamentos." },
    ],
  }),
  component: Contas,
});

function Contas() {
  const empresa = useEmpresa();
  const consulta = useQuery({
    queryKey: chaveComandas(empresa.id),
    queryFn: () => listarComandasAtivas(empresa.id),
    refetchInterval: 10_000,
  });
  const caixas = useQuery({
    queryKey: chaveCaixas(empresa.id),
    queryFn: () => listarCaixas(empresa.id),
    refetchInterval: 15_000,
  });
  const caixa = caixas.data ? caixaAberto(caixas.data) : undefined;
  const [mesa, setMesa] = useState("todas");
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const todas = useMemo(
    () => (consulta.data ?? []).filter((c) => comandaTemAtividade(c, agora)),
    [consulta.data, agora],
  );
  const mesas = useMemo(
    () => [...new Set(todas.map((c) => c.mesa_numero))].sort((a, b) => a - b),
    [todas],
  );
  const lista = todas.filter((c) => mesa === "todas" || String(c.mesa_numero) === mesa);
  const estado = estadoDaConsulta(consulta);

  return (
    <>
      <PageHeader
        titulo="Contas e pagamentos"
        descricao="Selecione uma conta para conferir os itens e registrar pagamentos."
        acoes={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/contas/caixa">
                <Landmark className="h-4 w-4" /> Caixa
              </Link>
            </Button>
            <Select value={mesa} onValueChange={setMesa}>
              <SelectTrigger className="w-48" aria-label="Filtrar por mesa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as mesas</SelectItem>
                {mesas.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Mesa {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      {caixas.isSuccess && !caixa ? (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm">
          <p className="font-medium text-warning">O caixa está fechado</p>
          <p className="mt-1 text-muted-foreground">
            Para registrar pagamentos, primeiro{" "}
            <Link to="/admin/contas/caixa" className="text-link underline">
              abra o caixa
            </Link>
            .
          </p>
        </div>
      ) : null}
      {estado ??
        (lista.length === 0 ? (
          <EmptyState
            icone={ReceiptText}
            titulo="Nenhuma conta em aberto"
            texto="As contas são criadas quando um cliente se identifica no cardápio da mesa."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((c) => {
              const pend = pedidosPendentesDaComanda(c, agora).length;
              const saldo = saldoDaComanda(c);
              const paga = c.status === "paga";
              return (
                <Link
                  key={c.id}
                  to="/admin/contas/$contaId"
                  params={{ contaId: c.id }}
                  className="rounded-xl border bg-card p-4 hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{c.cliente_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Mesa {c.mesa_numero} · desde {formatHora(c.aberta_em)}
                      </p>
                    </div>
                    {paga ? (
                      <Selo tom="sucesso">Paga</Selo>
                    ) : saldo === 0 && pend === 0 && devidoDaComanda(c) > 0 ? (
                      <Selo tom="sucesso">Quitada</Selo>
                    ) : pagoDaComanda(c) > 0 ? (
                      <Selo tom="alerta">Parcial</Selo>
                    ) : (
                      <Selo tom="info">Aberta</Selo>
                    )}
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Consumo</dt>
                      <dd className="tabular-nums">{formatBRL(devidoDaComanda(c))}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Pago</dt>
                      <dd className="tabular-nums">{formatBRL(pagoDaComanda(c))}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Saldo</dt>
                      <dd className="font-semibold tabular-nums text-link">{formatBRL(saldo)}</dd>
                    </div>
                  </dl>
                  {pend > 0 ? (
                    <p className="mt-2 text-xs text-warning">
                      {pend} pedido(s) aguardando confirmação
                    </p>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
    </>
  );
}
