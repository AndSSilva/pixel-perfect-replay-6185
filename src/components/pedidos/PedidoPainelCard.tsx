import { Check, Clock, PackageCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Selo } from "@/components/app/common";
import { MotivoDialog } from "@/components/pedidos/MotivoDialog";
import { formatBRL, formatDataHora } from "@/lib/format";
import {
  minutosParaExpirar,
  pedidoExpirado,
  totalDoPedido,
  type PedidoPainel,
} from "@/lib/pedidos/painel";
import { rotuloItem, rotuloPedido } from "@/lib/pedidos/rotulos";

export type AcoesPedido = {
  ocupado: boolean;
  confirmar: (p: PedidoPainel) => Promise<unknown>;
  rejeitar: (p: PedidoPainel, motivo: string) => Promise<unknown>;
  entregarPedido: (p: PedidoPainel) => Promise<unknown>;
  entregarItem: (itemId: string) => Promise<unknown>;
  cancelarItem: (itemId: string, motivo: string) => Promise<unknown>;
};

export function PedidoPainelCard({
  pedido,
  agora,
  acoes,
}: {
  pedido: PedidoPainel;
  agora: number;
  acoes: AcoesPedido;
}) {
  const expirado = pedido.status === "pendente" && pedidoExpirado(pedido.expira_em, agora);
  const r = rotuloPedido(pedido.status, expirado);
  const aguardando = pedido.itens.filter((i) => i.status === "aguardando");
  const emAndamento = pedido.status === "confirmado" && aguardando.length > 0;

  return (
    <article className="rounded-lg border bg-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            Mesa {pedido.mesa_numero} · {pedido.cliente_nome}
          </p>
          <p className="text-xs text-muted-foreground">
            Enviado em {formatDataHora(pedido.criado_em)}
            {pedido.confirmado_em ? ` · Confirmado em ${formatDataHora(pedido.confirmado_em)}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Selo tom={r.tom}>{r.texto}</Selo>
          <span className="text-lg font-semibold tabular-nums">
            {formatBRL(totalDoPedido(pedido))}
          </span>
        </div>
      </header>

      <ul className="mt-3 space-y-2 text-sm">
        {pedido.itens.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className={i.status === "cancelado" ? "text-muted-foreground line-through" : ""}>
              {i.quantidade}× {i.nome_produto}{" "}
              <span className="text-muted-foreground">
                ({formatBRL(i.preco_unitario_centavos)})
              </span>
              {pedido.status === "confirmado" ? (
                <span className="ml-2 text-xs text-muted-foreground">· {rotuloItem[i.status]}</span>
              ) : null}
              {i.motivo_cancelamento ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({i.motivo_cancelamento})
                </span>
              ) : null}
            </span>
            <span className="flex items-center gap-1">
              <span className="tabular-nums text-muted-foreground">
                {formatBRL(i.subtotal_centavos)}
              </span>
              {pedido.status === "confirmado" && i.status === "aguardando" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acoes.ocupado}
                    aria-label={`Entregar ${i.nome_produto}`}
                    onClick={() => void acoes.entregarItem(i.id).catch(() => undefined)}
                  >
                    <PackageCheck className="h-4 w-4" /> Entregar
                  </Button>
                  <MotivoDialog
                    gatilho={
                      <Button size="sm" variant="ghost" aria-label={`Cancelar ${i.nome_produto}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    }
                    titulo="Cancelar este item?"
                    descricao={`${i.quantidade}× ${i.nome_produto} sai da conta e a reserva é liberada. O estoque não muda.`}
                    rotuloAcao="Cancelar item"
                    obrigatorio
                    ocupado={acoes.ocupado}
                    onConfirmar={(m) => acoes.cancelarItem(i.id, m)}
                  />
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {pedido.motivo_rejeicao ? (
        <p className="mt-2 text-xs text-destructive">Motivo: {pedido.motivo_rejeicao}</p>
      ) : null}

      {pedido.status === "pendente" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={acoes.ocupado || expirado}
            onClick={() => void acoes.confirmar(pedido).catch(() => undefined)}
          >
            <Check className="h-4 w-4" /> Confirmar
          </Button>
          <MotivoDialog
            gatilho={
              <Button size="sm" variant="outline">
                <X className="h-4 w-4" /> Rejeitar
              </Button>
            }
            titulo="Rejeitar pedido?"
            descricao="O pedido fica no histórico como recusado e não entra na conta."
            rotuloAcao="Rejeitar pedido"
            obrigatorio={false}
            ocupado={acoes.ocupado}
            onConfirmar={(m) => acoes.rejeitar(pedido, m)}
          />
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {expirado
              ? "Expirado: rejeite para limpar a fila"
              : `Expira em ${minutosParaExpirar(pedido.expira_em, agora)} min`}
          </span>
        </div>
      ) : null}

      {emAndamento && aguardando.length > 1 ? (
        <div className="mt-4">
          <Button
            size="sm"
            disabled={acoes.ocupado}
            onClick={() => void acoes.entregarPedido(pedido).catch(() => undefined)}
          >
            <PackageCheck className="h-4 w-4" /> Entregar tudo
          </Button>
        </div>
      ) : null}
    </article>
  );
}
