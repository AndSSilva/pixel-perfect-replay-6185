import { createFileRoute, Link } from "@tanstack/react-router";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowLeft, ClipboardCheck, Copy, Download, ExternalLink, Printer, Unlock, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Confirmar, EmptyState, PageHeader, Painel, Selo, seloMesa } from "@/components/app/common";
import { PedidoCard } from "@/components/app/PedidoCard";
import { executar, useDados } from "@/lib/store";
import {
  contasDaSessao,
  iniciarFechamento,
  liberarMesa,
  retomarAtendimento,
  saldoConta,
  sessaoAtual,
  statusMesa,
  totalConfirmadoConta,
  totalPagoConta,
} from "@/lib/services/regras";
import { formatBRL, formatDataHora } from "@/lib/format";

export const Route = createFileRoute("/admin/mesas/$mesaId")({
  head: () => ({
    meta: [
      { title: "Detalhes da mesa — Gestão de Bebidas" },
      { name: "description", content: "Contas individuais, pedidos e QR Code da mesa." },
      { property: "og:title", content: "Detalhes da mesa — Gestão de Bebidas" },
      { property: "og:description", content: "Contas individuais, pedidos e QR Code da mesa." },
    ],
  }),
  component: MesaDetalhe,
});

export const linkCardapio = (mesaId: string) => `${window.location.origin}/cardapio/${mesaId}`;

function MesaDetalhe() {
  const { mesaId } = Route.useParams();
  const d = useDados()!;
  const mesa = d.mesas.find((m) => m.id === mesaId);
  if (!mesa)
    return (
      <EmptyState icone={ArrowLeft} titulo="Mesa não encontrada" acao={<Button asChild variant="secondary"><Link to="/admin/mesas">Voltar às mesas</Link></Button>} />
    );

  const st = statusMesa(d, mesa);
  const [tom, rot] = seloMesa[st];
  const sessao = sessaoAtual(d, mesa);
  const contas = sessao ? contasDaSessao(d, sessao.id) : [];
  const pedidos = sessao ? d.pedidos.filter((p) => p.sessaoId === sessao.id).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)) : [];
  const pendentes = pedidos.filter((p) => p.status === "pendente");
  const confirmados = pedidos.filter((p) => p.status === "confirmado");
  const rejeitados = pedidos.filter((p) => p.status === "rejeitado");
  const totalMesa = contas.reduce((s, c) => s + totalConfirmadoConta(d, c.id), 0);
  const pagoMesa = contas.reduce((s, c) => s + totalPagoConta(d, c.id), 0);
  const link = linkCardapio(mesa.id);

  const baixarQr = () => {
    const canvas = document.getElementById("qr-mesa") as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qrcode-${mesa.nome.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  return (
    <>
      <Link to="/admin/mesas" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Mesas
      </Link>
      <PageHeader
        titulo={mesa.nome}
        descricao={sessao ? `Atendimento aberto em ${formatDataHora(sessao.abertaEm)}` : "Sem atendimento ativo"}
        acoes={
          <>
            <Selo tom={tom}>{rot}</Selo>
            {sessao && sessao.status === "aberta" && (
              <Button size="sm" variant="secondary" onClick={() => executar((x) => iniciarFechamento(x, mesa.id), "Mesa em conferência para fechamento.")}>
                <ClipboardCheck className="h-4 w-4" /> Iniciar fechamento
              </Button>
            )}
            {sessao?.status === "fechamento" && (
              <Button size="sm" variant="ghost" onClick={() => executar((x) => retomarAtendimento(x, mesa.id), "Atendimento retomado.")}>
                <Undo2 className="h-4 w-4" /> Retomar atendimento
              </Button>
            )}
            {sessao && (
              <Confirmar
                gatilho={<Button size="sm"><Unlock className="h-4 w-4" /> Liberar mesa</Button>}
                titulo={`Liberar ${mesa.nome}?`}
                descricao="O atendimento será encerrado. Só é possível com todas as contas pagas e nenhum pedido pendente."
                rotuloAcao="Liberar mesa"
                onConfirmar={() => executar((x) => liberarMesa(x, mesa.id), "Mesa liberada.")}
              />
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[["Consumo confirmado", totalMesa], ["Pago", pagoMesa], ["Saldo em aberto", totalMesa - pagoMesa]].map(([r, v]) => (
              <div key={r as string} className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">{r}</p>
                <p className="mt-1 font-display text-lg font-semibold tabular">{formatBRL(v as number)}</p>
              </div>
            ))}
          </div>

          <Painel titulo="Contas individuais">
            {contas.length === 0 ? (
              <EmptyState icone={ClipboardCheck} titulo="Nenhum cliente identificado" texto="Quando alguém acessar o cardápio desta mesa e se identificar, a conta aparecerá aqui." />
            ) : (
              <ul className="space-y-2">
                {contas.map((c) => {
                  const saldo = saldoConta(d, c.id);
                  const pend = pendentes.filter((p) => p.contaId === c.id).length;
                  return (
                    <li key={c.id}>
                      <Link to="/admin/contas/$contaId" params={{ contaId: c.id }} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-elevated/40 p-3 hover:border-primary/40">
                        <div>
                          <p className="font-medium">{c.clienteNome}</p>
                          <p className="text-xs text-muted-foreground">
                            Consumo {formatBRL(totalConfirmadoConta(d, c.id))} · Pago {formatBRL(totalPagoConta(d, c.id))}
                            {pend > 0 && <span className="text-warning"> · {pend} pendente(s)</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tabular text-sm font-semibold">{formatBRL(saldo)}</span>
                          {c.status === "paga" ? <Selo tom="sucesso">Paga</Selo> : <Selo tom="info">Aberta</Selo>}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Painel>

          <Painel titulo={`Pedidos pendentes (${pendentes.length})`} className={pendentes.length ? "border-warning/40" : undefined}>
            {pendentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pedido aguardando confirmação.</p>
            ) : (
              <div className="space-y-3">{pendentes.map((p) => <PedidoCard key={p.id} d={d} pedido={p} mostrarMesa={false} />)}</div>
            )}
          </Painel>

          <Painel titulo={`Pedidos confirmados (${confirmados.length})`}>
            {confirmados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum consumo confirmado ainda.</p>
            ) : (
              <div className="space-y-3">{confirmados.map((p) => <PedidoCard key={p.id} d={d} pedido={p} mostrarMesa={false} />)}</div>
            )}
          </Painel>

          {rejeitados.length > 0 && (
            <details className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium">Pedidos rejeitados ({rejeitados.length})</summary>
              <div className="mt-3 space-y-3">{rejeitados.map((p) => <PedidoCard key={p.id} d={d} pedido={p} mostrarMesa={false} />)}</div>
            </details>
          )}
        </div>

        <Painel titulo="QR Code da mesa" className="h-fit">
          <div className="flex justify-center rounded-lg bg-foreground p-4">
            <QRCodeCanvas id="qr-mesa" value={link} size={200} marginSize={1} />
          </div>
          <p className="mt-3 break-all text-xs text-muted-foreground">{link}</p>
          <div className="mt-3 grid gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copiado."), () => toast.error("Não foi possível copiar."))}>
              <Copy className="h-4 w-4" /> Copiar link
            </Button>
            <Button size="sm" variant="secondary" onClick={baixarQr}><Download className="h-4 w-4" /> Baixar imagem</Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/admin/imprimir/$mesaId" params={{ mesaId: mesa.id }}><Printer className="h-4 w-4" /> Versão para impressão</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/cardapio/$mesaId" params={{ mesaId: mesa.id }}><ExternalLink className="h-4 w-4" /> Abrir cardápio</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Nesta versão, os pedidos aparecem no painel apenas quando feitos neste mesmo navegador.
          </p>
        </Painel>
      </div>
    </>
  );
}
