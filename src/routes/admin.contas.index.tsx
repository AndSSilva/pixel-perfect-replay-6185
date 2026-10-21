import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ReceiptText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader, Selo } from "@/components/app/common";
import { useDados } from "@/lib/store";
import { pedidosPendentesConta, saldoConta, totalConfirmadoConta, totalPagoConta } from "@/lib/services/regras";
import { formatBRL, formatHora } from "@/lib/format";

export const Route = createFileRoute("/admin/contas/")({
  head: () => ({
    meta: [
      { title: "Contas e pagamentos — Gestão de Bebidas" },
      { name: "description", content: "Contas individuais abertas e registro de pagamentos." },
      { property: "og:title", content: "Contas e pagamentos — Gestão de Bebidas" },
      { property: "og:description", content: "Contas individuais abertas e registro de pagamentos." },
    ],
  }),
  component: Contas,
});

function Contas() {
  const d = useDados()!;
  const [mesa, setMesa] = useState("todas");
  const abertas = d.contas.filter((c) => c.status === "aberta" && (mesa === "todas" || c.mesaId === mesa));
  const mesasComContas = d.mesas.filter((m) => d.contas.some((c) => c.status === "aberta" && c.mesaId === m.id));

  return (
    <>
      <PageHeader
        titulo="Contas e pagamentos"
        descricao="Selecione uma conta para conferir os itens e registrar pagamentos."
        acoes={
          <Select value={mesa} onValueChange={setMesa}>
            <SelectTrigger className="w-48" aria-label="Filtrar por mesa"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as mesas</SelectItem>
              {mesasComContas.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      {abertas.length === 0 ? (
        <EmptyState icone={ReceiptText} titulo="Nenhuma conta aberta" texto="As contas são criadas quando um cliente se identifica no cardápio." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {abertas.map((c) => {
            const pend = pedidosPendentesConta(d, c.id).length;
            const saldo = saldoConta(d, c.id);
            return (
              <Link key={c.id} to="/admin/contas/$contaId" params={{ contaId: c.id }} className="rounded-xl border bg-card p-4 hover:border-primary/40">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{c.clienteNome}</p>
                    <p className="text-xs text-muted-foreground">{c.mesaNome} · desde {formatHora(c.abertaEm)}</p>
                  </div>
                  {saldo === 0 && pend === 0 ? <Selo tom="sucesso">Quitada</Selo> : totalPagoConta(d, c.id) > 0 ? <Selo tom="alerta">Parcial</Selo> : <Selo tom="info">Aberta</Selo>}
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div><dt className="text-muted-foreground">Consumo</dt><dd className="tabular">{formatBRL(totalConfirmadoConta(d, c.id))}</dd></div>
                  <div><dt className="text-muted-foreground">Pago</dt><dd className="tabular">{formatBRL(totalPagoConta(d, c.id))}</dd></div>
                  <div><dt className="text-muted-foreground">Saldo</dt><dd className="tabular font-semibold text-primary">{formatBRL(saldo)}</dd></div>
                </dl>
                {pend > 0 && <p className="mt-2 text-xs text-warning">{pend} pedido(s) aguardando confirmação</p>}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
