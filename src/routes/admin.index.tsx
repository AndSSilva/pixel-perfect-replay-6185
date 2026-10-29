import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleDollarSign, ClipboardList, Inbox, ReceiptText, UtensilsCrossed, Armchair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Painel, Selo, StatCard, seloMesa, seloPedido } from "@/components/app/common";
import { useDados } from "@/lib/store";
import { contasDaSessao, saldoConta, statusMesa, totalConfirmadoConta, totalPagoConta } from "@/lib/services/regras";
import { formatBRL, formatDataHora, formatHora, mesmoDia } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Mesa Digital" },
      { name: "description", content: "Visão geral de mesas, pedidos e vendas do dia." },
      { property: "og:title", content: "Dashboard — Mesa Digital" },
      { property: "og:description", content: "Visão geral de mesas, pedidos e vendas do dia." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const d = useDados()!;
  const hoje = new Date();
  const status = d.mesas.map((m) => statusMesa(d, m));
  const disponiveis = status.filter((s) => s === "disponivel").length;
  const ocupadas = d.mesas.filter((m) => m.sessaoAtualId);
  const pendentes = d.pedidos.filter((p) => p.status === "pendente").length;
  const abertas = d.contas.filter((c) => c.status === "aberta").length;
  const fechadasHoje = d.contas.filter((c) => c.status === "paga" && c.fechadaEm && mesmoDia(new Date(c.fechadaEm), hoje));
  const vendasHoje = fechadasHoje.reduce((s, c) => s + totalPagoConta(d, c.id), 0);
  const recentes = [...d.pedidos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 6);
  const ultimasFechadas = d.contas
    .filter((c) => c.status === "paga")
    .sort((a, b) => (b.fechadaEm ?? "").localeCompare(a.fechadaEm ?? ""))
    .slice(0, 5);

  return (
    <>
      <PageHeader titulo="Dashboard" descricao={hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard rotulo="Mesas disponíveis" valor={disponiveis} icone={Armchair} />
        <StatCard rotulo="Mesas ocupadas" valor={ocupadas.length} icone={UtensilsCrossed} />
        <StatCard rotulo="Aguardando confirmação" valor={pendentes} icone={ClipboardList} destaque={pendentes > 0} />
        <StatCard rotulo="Contas abertas" valor={abertas} icone={ReceiptText} />
        <StatCard rotulo="Vendas do dia" valor={formatBRL(vendasHoje)} icone={CircleDollarSign} destaque />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Painel titulo="Pedidos recentes" acao={<Button asChild variant="ghost" size="sm"><Link to="/admin/pedidos">Ver todos</Link></Button>}>
          {recentes.length === 0 ? (
            <EmptyState icone={Inbox} titulo="Nenhum pedido ainda" texto="Os pedidos enviados pelo cardápio aparecerão aqui." />
          ) : (
            <ul className="divide-y">
              {recentes.map((p) => {
                const c = d.contas.find((x) => x.id === p.contaId);
                const [tom, rot] = seloPedido[p.status];
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c?.clienteNome} · {c?.mesaNome}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatHora(p.criadoEm)} · {p.itens.reduce((s, i) => s + i.quantidade, 0)} itens
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="tabular font-medium">{formatBRL(p.totalCentavos)}</span>
                      <Selo tom={tom}>{rot}</Selo>
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
                  const contas = contasDaSessao(d, m.sessaoAtualId!);
                  const total = contas.reduce((s, c) => s + totalConfirmadoConta(d, c.id), 0);
                  const saldo = contas.reduce((s, c) => s + saldoConta(d, c.id), 0);
                  const [tom, rot] = seloMesa[statusMesa(d, m)];
                  return (
                    <li key={m.id}>
                      <Link to="/admin/mesas/$mesaId" params={{ mesaId: m.id }} className="flex items-center justify-between rounded-lg border bg-elevated/40 px-3 py-2.5 hover:border-primary/40">
                        <div>
                          <p className="font-medium">{m.nome}</p>
                          <p className="text-xs text-muted-foreground">{contas.length} contas · consumo {formatBRL(total)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Selo tom={tom}>{rot}</Selo>
                          <span className="text-xs text-muted-foreground">saldo {formatBRL(saldo)}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Painel>
          <Painel titulo="Últimas contas fechadas">
            {ultimasFechadas.length === 0 ? (
              <EmptyState icone={ReceiptText} titulo="Nenhuma venda registrada" />
            ) : (
              <ul className="divide-y text-sm">
                {ultimasFechadas.map((c) => (
                  <li key={c.id} className="flex justify-between py-2.5">
                    <div>
                      <p className="font-medium">{c.clienteNome} · {c.mesaNome}</p>
                      <p className="text-xs text-muted-foreground">{formatDataHora(c.fechadaEm)}</p>
                    </div>
                    <span className="tabular">{formatBRL(totalPagoConta(d, c.id))}</span>
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
