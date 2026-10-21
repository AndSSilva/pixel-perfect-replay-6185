import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader, StatCard } from "@/components/app/common";
import { useDados } from "@/lib/store";
import { totalPagoConta } from "@/lib/services/regras";
import { formatBRL, formatDataHora, idCurto } from "@/lib/format";
import { FORMAS_PAGAMENTO, rotuloForma } from "@/lib/types";
import { CircleDollarSign, ReceiptText } from "lucide-react";

export const Route = createFileRoute("/admin/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de vendas — Gestão de Bebidas" },
      { name: "description", content: "Contas fechadas, itens consumidos e pagamentos." },
      { property: "og:title", content: "Histórico de vendas — Gestão de Bebidas" },
      { property: "og:description", content: "Contas fechadas, itens consumidos e pagamentos." },
    ],
  }),
  component: Historico,
});

function Historico() {
  const d = useDados()!;
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [cliente, setCliente] = useState("");
  const [mesa, setMesa] = useState("todas");
  const [forma, setForma] = useState("todas");

  const nomesMesas = [...new Set(d.contas.filter((c) => c.status === "paga").map((c) => c.mesaNome))].sort();
  const lista = d.contas
    .filter((c) => c.status === "paga" && c.fechadaEm)
    .filter((c) => {
      const local = new Date(c.fechadaEm!).toLocaleDateString("sv-SE"); // YYYY-MM-DD local
      if (de && local < de) return false;
      if (ate && local > ate) return false;
      if (cliente && !c.clienteNome.toLowerCase().includes(cliente.trim().toLowerCase())) return false;
      if (mesa !== "todas" && c.mesaNome !== mesa) return false;
      if (forma !== "todas" && !d.pagamentos.some((p) => p.contaId === c.id && p.formaPagamento === forma)) return false;
      return true;
    })
    .sort((a, b) => b.fechadaEm!.localeCompare(a.fechadaEm!));
  const total = lista.reduce((s, c) => s + totalPagoConta(d, c.id), 0);

  return (
    <>
      <PageHeader titulo="Histórico de vendas" descricao="Somente contas fechadas. Pedidos pendentes ou rejeitados não entram." />
      <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5"><Label htmlFor="de">De</Label><Input id="de" type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="ate">Até</Label><Input id="ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="cli">Cliente</Label><Input id="cli" placeholder="Nome" value={cliente} onChange={(e) => setCliente(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label htmlFor="fmesa">Mesa</Label>
          <Select value={mesa} onValueChange={setMesa}>
            <SelectTrigger id="fmesa"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todas">Todas</SelectItem>{nomesMesas.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fforma">Forma de pagamento</Label>
          <Select value={forma} onValueChange={setForma}>
            <SelectTrigger id="fforma"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todas">Todas</SelectItem>{FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <StatCard rotulo="Contas" valor={lista.length} icone={ReceiptText} />
        <StatCard rotulo="Total vendido" valor={formatBRL(total)} icone={CircleDollarSign} destaque />
      </div>

      {lista.length === 0 ? (
        <EmptyState icone={History} titulo="Nenhuma venda encontrada" texto="Ajuste os filtros ou feche contas para vê-las aqui." />
      ) : (
        <div className="space-y-2">
          {lista.map((c) => {
            const pgs = d.pagamentos.filter((p) => p.contaId === c.id);
            const itens = d.pedidos.filter((p) => p.contaId === c.id && p.status === "confirmado").flatMap((p) => p.itens);
            return (
              <details key={c.id} className="group rounded-xl border bg-card">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{c.clienteNome} · {c.mesaNome}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{idCurto(c.id)}</span> · {formatDataHora(c.fechadaEm)} · {[...new Set(pgs.map((p) => rotuloForma(p.formaPagamento)))].join(", ")}
                    </p>
                  </div>
                  <span className="font-display text-lg font-semibold tabular">{formatBRL(totalPagoConta(d, c.id))}</span>
                </summary>
                <div className="grid gap-4 border-t p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Itens consumidos</p>
                    <ul className="space-y-1">
                      {itens.map((i, k) => (
                        <li key={k} className="flex justify-between"><span>{i.quantidade}× {i.nomeProduto}</span><span className="tabular">{formatBRL(i.subtotalCentavos)}</span></li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Pagamentos</p>
                    <ul className="space-y-1">
                      {pgs.map((p) => (
                        <li key={p.id} className="flex justify-between"><span>{rotuloForma(p.formaPagamento)} <span className="text-xs text-muted-foreground">{formatDataHora(p.criadoEm)}</span></span><span className="tabular">{formatBRL(p.valorCentavos)}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </>
  );
}
