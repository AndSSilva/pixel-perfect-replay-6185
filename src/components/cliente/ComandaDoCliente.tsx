import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Selo } from "@/components/app/common";
import { formatBRL, formatHora } from "@/lib/format";
import { cancelarMeuPedido, chaveMinhaComanda } from "@/lib/pedidos/servico-cliente";
import { mensagemDoErroPedido, type ComandaCliente } from "@/lib/pedidos/tipos";
import { rotuloForma, rotuloItem, rotuloPedido } from "@/lib/pedidos/rotulos";

export function ComandaDoCliente({
  token,
  comanda,
  aoNovaComanda,
}: {
  token: string;
  comanda: ComandaCliente;
  aoNovaComanda: () => void;
}) {
  const qc = useQueryClient();
  const cancelar = useMutation({
    mutationFn: (pedidoId: string) => cancelarMeuPedido(token, pedidoId),
    onSuccess: () => {
      toast.success("Pedido cancelado.");
      void qc.invalidateQueries({ queryKey: chaveMinhaComanda(token) });
    },
    onError: (e) => {
      toast.error(mensagemDoErroPedido(e));
      void qc.invalidateQueries({ queryKey: chaveMinhaComanda(token) });
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total confirmado</dt>
            <dd className="tabular-nums">{formatBRL(comanda.devido_centavos)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Pago</dt>
            <dd className="tabular-nums">{formatBRL(comanda.pago_centavos)}</dd>
          </div>
          <div className="flex justify-between border-t pt-1 text-base font-semibold">
            <dt>A pagar</dt>
            <dd className="tabular-nums">{formatBRL(comanda.saldo_centavos)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">O pagamento é feito com o atendente.</p>
      </div>

      {comanda.comanda.status === "paga" ? (
        <div className="rounded-lg border bg-card p-4 text-sm">
          <p className="font-medium">Comanda encerrada. Obrigado!</p>
          <Button className="mt-3" variant="outline" onClick={aoNovaComanda}>
            Abrir nova comanda
          </Button>
        </div>
      ) : null}

      {comanda.pedidos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Você ainda não fez pedidos.</p>
      ) : (
        comanda.pedidos.map((p) => {
          const r = rotuloPedido(p.status, p.expirado);
          return (
            <article key={p.id} className="rounded-lg border bg-card p-3">
              <header className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{formatHora(p.criado_em)}</span>
                <Selo tom={r.tom}>{r.texto}</Selo>
              </header>
              <ul className="mt-2 space-y-1 text-sm">
                {p.itens.map((i) => (
                  <li key={i.id} className="flex justify-between gap-2">
                    <span
                      className={
                        i.status === "cancelado" ? "text-muted-foreground line-through" : ""
                      }
                    >
                      {i.quantidade}× {i.nome_produto}
                      {p.status === "confirmado" ? (
                        <em className="ml-1 text-xs not-italic text-muted-foreground">
                          ({rotuloItem[i.status]})
                        </em>
                      ) : null}
                    </span>
                    <span className="tabular-nums">{formatBRL(i.subtotal_centavos)}</span>
                  </li>
                ))}
              </ul>
              {p.itens.some((i) => i.motivo_cancelamento) ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.itens
                    .filter((i) => i.motivo_cancelamento)
                    .map((i) => `${i.nome_produto}: ${i.motivo_cancelamento}`)
                    .join(" · ")}
                </p>
              ) : null}
              {p.motivo_rejeicao ? (
                <p className="mt-1 text-xs text-muted-foreground">Motivo: {p.motivo_rejeicao}</p>
              ) : null}
              {p.status === "pendente" && !p.expirado ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={cancelar.isPending}
                  onClick={() => cancelar.mutate(p.id)}
                >
                  Cancelar pedido
                </Button>
              ) : null}
            </article>
          );
        })
      )}

      {comanda.pagamentos.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold">Pagamentos</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {comanda.pagamentos.map((g, idx) => (
              <li key={idx} className="flex justify-between">
                <span>
                  {rotuloForma[g.forma]} · {formatHora(g.criado_em)}
                </span>
                <span className="tabular-nums">{formatBRL(g.valor_centavos)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
