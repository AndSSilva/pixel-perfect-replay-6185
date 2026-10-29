import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Confirmar, Selo, seloPedido } from "./common";
import { executar } from "@/lib/store";
import { confirmarPedido, rejeitarPedido } from "@/lib/services/regras";
import { formatBRL, formatDataHora, idCurto } from "@/lib/format";
import type { AppData, Pedido } from "@/lib/types";

export function PedidoCard({ d, pedido, mostrarMesa = true }: { d: AppData; pedido: Pedido; mostrarMesa?: boolean }) {
  const [motivo, setMotivo] = useState("");
  const conta = d.contas.find((c) => c.id === pedido.contaId);
  const mesa = d.mesas.find((m) => m.id === pedido.mesaId);
  const [tom, rotulo] = seloPedido[pedido.status];
  const qtd = pedido.itens.reduce((s, i) => s + i.quantidade, 0);

  return (
    <article className="rounded-lg border bg-elevated/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{idCurto(pedido.id)}</span>
            <Selo tom={tom}>{rotulo}</Selo>
          </div>
          <p className="mt-1 font-medium">
            {conta?.clienteNome ?? "Cliente"}
            {mostrarMesa && (
              <>
                {" · "}
                {mesa ? (
                  <Link to="/admin/mesas/$mesaId" params={{ mesaId: mesa.id }} className="text-link hover:underline">
                    {mesa.nome}
                  </Link>
                ) : (
                  conta?.mesaNome
                )}
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Enviado em {formatDataHora(pedido.criadoEm)} · {qtd} {qtd === 1 ? "item" : "itens"}
            {pedido.confirmadoEm && ` · Confirmado em ${formatDataHora(pedido.confirmadoEm)}`}
          </p>
        </div>
        <span className="font-display text-lg font-semibold tabular">{formatBRL(pedido.totalCentavos)}</span>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {pedido.itens.map((i) => {
          const atual = d.produtos.find((p) => p.id === i.produtoId);
          const mudou = pedido.status === "pendente" && atual && atual.precoCentavos !== i.precoUnitarioCentavos;
          return (
            <li key={i.produtoId} className="flex justify-between gap-2">
              <span>
                {i.quantidade}× {i.nomeProduto}{" "}
                <span className="text-muted-foreground">({formatBRL(i.precoUnitarioCentavos)})</span>
                {mudou && <span className="ml-1 text-xs text-warning">preço atual {formatBRL(atual.precoCentavos)}</span>}
              </span>
              <span className="tabular text-muted-foreground">{formatBRL(i.subtotalCentavos)}</span>
            </li>
          );
        })}
      </ul>
      {pedido.motivoRejeicao && <p className="mt-2 text-xs text-destructive">Motivo: {pedido.motivoRejeicao}</p>}

      {pedido.status === "pendente" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => executar((x) => confirmarPedido(x, pedido.id), "Pedido confirmado.")}>
            <Check className="h-4 w-4" /> Confirmar
          </Button>
          <Confirmar
            gatilho={
              <Button size="sm" variant="outline">
                <X className="h-4 w-4" /> Rejeitar
              </Button>
            }
            titulo="Rejeitar pedido?"
            descricao="O pedido ficará no histórico como rejeitado e não será cobrado."
            rotuloAcao="Rejeitar pedido"
            perigo
            onConfirmar={() => executar((x) => rejeitarPedido(x, pedido.id, motivo), "Pedido rejeitado.")}
          >
            <div className="space-y-1.5">
              <Label htmlFor={`motivo-${pedido.id}`}>Motivo (opcional)</Label>
              <Textarea id={`motivo-${pedido.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} />
            </div>
          </Confirmar>
        </div>
      )}
    </article>
  );
}
