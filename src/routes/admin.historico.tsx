import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, History, ReceiptText, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader, StatCard } from "@/components/app/common";
import { estadoDaConsulta } from "@/components/app/Consulta";
import { useEmpresa } from "@/lib/empresa/contexto";
import { formatBRL, formatDataHora } from "@/lib/format";
import { devidoDaComanda } from "@/lib/pedidos/contas";
import { rotuloForma } from "@/lib/pedidos/rotulos";
import { LIMITE_VENDAS, chaveVendas, listarContasFechadas } from "@/lib/pedidos/servico-painel";
import {
  diaLocal,
  filtrarVendas,
  limitesDoPeriodo,
  lucroDaComanda,
  totaisDasVendas,
  type FiltroVendas,
} from "@/lib/pedidos/vendas";

export const Route = createFileRoute("/admin/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de vendas — Mesa Digital" },
      { name: "description", content: "Contas fechadas, itens consumidos e pagamentos." },
    ],
  }),
  component: Historico,
});

const FORMAS = ["pix", "dinheiro", "debito", "credito", "outro"] as const;

function Historico() {
  const empresa = useEmpresa();
  const hoje = new Date();
  const [de, setDe] = useState(() =>
    diaLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 6)),
  );
  const [ate, setAte] = useState(() => diaLocal(hoje));
  const [cliente, setCliente] = useState("");
  const [mesa, setMesa] = useState("todas");
  const [forma, setForma] = useState<FiltroVendas["forma"]>("todas");

  const limites = limitesDoPeriodo(de, ate);
  const consulta = useQuery({
    queryKey: chaveVendas(empresa.id, de, ate),
    queryFn: () => listarContasFechadas(empresa.id, limites!.inicio, limites!.fim),
    enabled: limites !== null,
  });

  const todas = useMemo(() => consulta.data?.contas ?? [], [consulta.data]);
  const mesas = useMemo(
    () => [...new Set(todas.map((c) => c.mesa_numero))].sort((a, b) => a - b),
    [todas],
  );
  const lista = useMemo(
    () => filtrarVendas(todas, { cliente, mesa, forma }),
    [todas, cliente, mesa, forma],
  );
  const totais = useMemo(() => totaisDasVendas(lista), [lista]);
  const estado = limites ? estadoDaConsulta(consulta) : null;

  return (
    <>
      <PageHeader
        titulo="Histórico de vendas"
        descricao="Somente contas fechadas. Pedidos pendentes ou rejeitados não entram."
      />
      <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="de">De</Label>
          <Input id="de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ate">Até</Label>
          <Input id="ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cli">Cliente</Label>
          <Input
            id="cli"
            placeholder="Nome"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fmesa">Mesa</Label>
          <Select value={mesa} onValueChange={setMesa}>
            <SelectTrigger id="fmesa">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {mesas.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Mesa {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fforma">Forma de pagamento</Label>
          <Select value={forma} onValueChange={(v) => setForma(v as FiltroVendas["forma"])}>
            <SelectTrigger id="fforma">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {FORMAS.map((f) => (
                <SelectItem key={f} value={f}>
                  {rotuloForma[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {limites === null ? (
        <EmptyState
          icone={History}
          titulo="Período inválido"
          texto="Informe as datas e confira se “Até” não é anterior a “De”."
        />
      ) : (
        (estado ?? (
          <>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard rotulo="Contas" valor={totais.contas} icone={ReceiptText} />
              <StatCard
                rotulo="Total vendido"
                valor={formatBRL(totais.vendido)}
                icone={CircleDollarSign}
                destaque
              />
              <StatCard rotulo="Lucro" valor={formatBRL(totais.lucro)} icone={TrendingUp} />
            </div>
            {totais.itensSemCusto > 0 ? (
              <p className="mb-4 text-xs text-muted-foreground">
                Lucro parcial: {totais.itensSemCusto} item(ns) vendido(s) sem preço de custo
                cadastrado não entram no cálculo.
              </p>
            ) : null}
            {consulta.data?.truncado ? (
              <p className="mb-4 text-xs text-warning">
                Mostrando as {LIMITE_VENDAS} contas mais recentes do período. Reduza o período para
                ver as demais.
              </p>
            ) : null}
            {lista.length === 0 ? (
              <EmptyState
                icone={History}
                titulo="Nenhuma venda encontrada"
                texto="Ajuste os filtros ou feche contas para vê-las aqui."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="p-3 font-medium">Fechada em</th>
                      <th className="p-3 font-medium">Cliente</th>
                      <th className="p-3 font-medium">Mesa</th>
                      <th className="p-3 font-medium">Pagamento</th>
                      <th className="p-3 text-right font-medium">Total</th>
                      <th className="p-3 text-right font-medium">Lucro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lista.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/40">
                        <td className="p-3 whitespace-nowrap">
                          <Link
                            to="/admin/contas/$contaId"
                            params={{ contaId: c.id }}
                            className="text-link hover:underline"
                          >
                            {formatDataHora(c.fechada_em)}
                          </Link>
                        </td>
                        <td className="p-3">{c.cliente_nome}</td>
                        <td className="p-3">Mesa {c.mesa_numero}</td>
                        <td className="p-3">
                          {[...new Set(c.pagamentos.map((g) => rotuloForma[g.forma]))].join(", ") ||
                            "—"}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {formatBRL(devidoDaComanda(c))}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {formatBRL(lucroDaComanda(c).lucro)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ))
      )}
    </>
  );
}
