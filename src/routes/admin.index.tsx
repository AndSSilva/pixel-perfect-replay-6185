import { useMemo, useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Armchair,
  CircleDollarSign,
  ClipboardList,
  Inbox,
  ReceiptText,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Painel, Selo, StatCard } from "@/components/app/common";
import { estadoDaConsulta } from "@/components/app/Consulta";
import { chaveMesas, listarMesas } from "@/lib/catalogo/servico";
import { rotuloMesa } from "@/lib/catalogo/mesas";
import { useEmpresa } from "@/lib/empresa/contexto";
import { formatBRL, formatDataHora, formatHora } from "@/lib/format";
import {
  comandaTemAtividade,
  devidoDaComanda,
  saldoDaComanda,
  situacaoDaMesa,
} from "@/lib/pedidos/contas";
import { pedidoExpirado, totalDoPedido } from "@/lib/pedidos/painel";
import { rotuloPedido } from "@/lib/pedidos/rotulos";
import {
  chaveComandas,
  chavePedidos,
  chaveSessoes,
  chaveVendas,
  listarComandasAtivas,
  listarContasFechadas,
  listarPedidos,
  listarSessoesAtivas,
} from "@/lib/pedidos/servico-painel";
import { diaLocal, lucroDaComanda, totaisDasVendas } from "@/lib/pedidos/vendas";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Mesa Digital" },
      { name: "description", content: "Visão geral de mesas, pedidos e vendas do dia." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const empresa = useEmpresa();
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const hoje = new Date(agora);
  const dia = diaLocal(hoje);
  const inicioDoDia = useMemo(
    () => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()),
    [dia], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const fimExato = useMemo(
    () => new Date(inicioDoDia.getFullYear(), inicioDoDia.getMonth(), inicioDoDia.getDate() + 1),
    [inicioDoDia],
  );

  const refetchInterval = 15_000;
  const mesas = useQuery({
    queryKey: chaveMesas(empresa.id),
    queryFn: () => listarMesas(empresa.id),
  });
  const sessoes = useQuery({
    queryKey: chaveSessoes(empresa.id),
    queryFn: () => listarSessoesAtivas(empresa.id),
    refetchInterval,
  });
  const comandas = useQuery({
    queryKey: chaveComandas(empresa.id),
    queryFn: () => listarComandasAtivas(empresa.id),
    refetchInterval,
  });
  const pedidos = useQuery({
    queryKey: chavePedidos(empresa.id),
    queryFn: () => listarPedidos(empresa.id),
    refetchInterval,
  });
  const vendas = useQuery({
    queryKey: chaveVendas(empresa.id, dia, dia),
    queryFn: () => listarContasFechadas(empresa.id, inicioDoDia, fimExato),
    refetchInterval,
  });

  const pronto =
    estadoDaConsulta(mesas) ??
    estadoDaConsulta(sessoes) ??
    estadoDaConsulta(comandas) ??
    estadoDaConsulta(pedidos) ??
    estadoDaConsulta(vendas);
  if (pronto) return pronto;

  const listaMesas = mesas.data ?? [];
  const listaSessoes = sessoes.data ?? [];
  const sessaoDe = (id: string) => listaSessoes.find((s) => s.mesa_id === id);
  const situacao = (m: (typeof listaMesas)[number]) => situacaoDaMesa(m, sessaoDe(m.id));
  const livres = listaMesas.filter((m) => situacao(m) === "livre").length;
  const ocupadas = listaMesas.filter((m) => ["ocupada", "fechamento"].includes(situacao(m)));
  const todosPedidos = pedidos.data ?? [];
  const pendentes = todosPedidos.filter(
    (p) => p.status === "pendente" && !pedidoExpirado(p.expira_em, agora),
  ).length;
  const recentes = todosPedidos.slice(0, 6);
  const contasAtivas = comandas.data ?? [];
  const abertas = contasAtivas.filter(
    (c) => c.status === "aberta" && comandaTemAtividade(c, agora),
  ).length;
  const fechadasHoje = vendas.data?.contas ?? [];
  const totais = totaisDasVendas(fechadasHoje);

  return (
    <>
      <PageHeader
        titulo="Dashboard"
        descricao={hoje.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard rotulo="Mesas livres" valor={livres} icone={Armchair} />
        <StatCard rotulo="Mesas ocupadas" valor={ocupadas.length} icone={UtensilsCrossed} />
        <StatCard
          rotulo="Aguardando confirmação"
          valor={pendentes}
          icone={ClipboardList}
          destaque={pendentes > 0}
        />
        <StatCard rotulo="Contas abertas" valor={abertas} icone={ReceiptText} />
        <StatCard
          rotulo="Vendas do dia"
          valor={formatBRL(totais.vendido)}
          icone={CircleDollarSign}
          destaque
        />
        <StatCard rotulo="Lucro do dia" valor={formatBRL(totais.lucro)} icone={TrendingUp} />
      </div>
      {totais.itensSemCusto > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Lucro parcial: {totais.itensSemCusto} item(ns) vendido(s) hoje sem preço de custo
          cadastrado não entram no cálculo.
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Painel
          titulo="Pedidos recentes"
          acao={
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/pedidos">Ver todos</Link>
            </Button>
          }
        >
          {recentes.length === 0 ? (
            <EmptyState
              icone={Inbox}
              titulo="Nenhum pedido ainda"
              texto="Os pedidos enviados pelo cardápio aparecerão aqui."
            />
          ) : (
            <ul className="divide-y">
              {recentes.map((p) => {
                const r = rotuloPedido(
                  p.status,
                  p.status === "pendente" && pedidoExpirado(p.expira_em, agora),
                );
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {p.cliente_nome} · Mesa {p.mesa_numero}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatHora(p.criado_em)} · {p.itens.reduce((s, i) => s + i.quantidade, 0)}{" "}
                        itens
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-medium tabular-nums">
                        {formatBRL(totalDoPedido(p))}
                      </span>
                      <Selo tom={r.tom}>{r.texto}</Selo>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>

        <div className="space-y-6">
          <Painel titulo="Mesas ocupadas">
            {ocupadas.length === 0 ? (
              <EmptyState icone={Armchair} titulo="Todas as mesas estão livres" />
            ) : (
              <ul className="space-y-2">
                {ocupadas.map((m) => {
                  const s = sessaoDe(m.id);
                  const contas = contasAtivas.filter((c) => c.sessao_id === s?.id);
                  return (
                    <li key={m.id}>
                      <Link
                        to="/admin/mesas/$mesaId"
                        params={{ mesaId: m.id }}
                        className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 hover:border-primary/40"
                      >
                        <div>
                          <p className="font-medium">{rotuloMesa(m.numero)}</p>
                          <p className="text-xs text-muted-foreground">
                            {contas.length} contas · consumo{" "}
                            {formatBRL(contas.reduce((a, c) => a + devidoDaComanda(c), 0))}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Selo tom={s?.status === "fechamento" ? "alerta" : "destaque"}>
                            {s?.status === "fechamento" ? "Em fechamento" : "Ocupada"}
                          </Selo>
                          <span className="text-xs text-muted-foreground">
                            saldo {formatBRL(contas.reduce((a, c) => a + saldoDaComanda(c), 0))}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Painel>
          <Painel titulo="Últimas contas fechadas hoje">
            {fechadasHoje.length === 0 ? (
              <EmptyState icone={ReceiptText} titulo="Nenhuma venda hoje" />
            ) : (
              <ul className="divide-y text-sm">
                {fechadasHoje.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex justify-between py-2.5">
                    <div>
                      <Link
                        to="/admin/contas/$contaId"
                        params={{ contaId: c.id }}
                        className="font-medium text-link hover:underline"
                      >
                        {c.cliente_nome} · Mesa {c.mesa_numero}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDataHora(c.fechada_em)}
                      </p>
                    </div>
                    <span className="tabular-nums">{formatBRL(devidoDaComanda(c))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </div>
      </div>
    </>
  );
}
