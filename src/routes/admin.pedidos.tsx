import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader } from "@/components/app/common";
import { estadoDaConsulta } from "@/components/app/Consulta";
import { PedidoPainelCard, type AcoesPedido } from "@/components/pedidos/PedidoPainelCard";
import { useEmpresa } from "@/lib/empresa/contexto";
import { agruparPedidos } from "@/lib/pedidos/painel";
import {
  cancelarItem,
  atualizarAtendimento,
  chavePedidos,
  confirmarPedido,
  entregarItens,
  entregarPedido,
  listarPedidos,
  rejeitarPedido,
} from "@/lib/pedidos/servico-painel";
import { ErroPedido, mensagemDoErroPedido } from "@/lib/pedidos/tipos";

export const Route = createFileRoute("/admin/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos — Mesa Digital" },
      { name: "description", content: "Fila de pedidos: confirmar, entregar e cancelar itens." },
    ],
  }),
  component: Pedidos,
});

function Pedidos() {
  const empresa = useEmpresa();
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: chavePedidos(empresa.id),
    queryFn: () => listarPedidos(empresa.id),
    refetchInterval: 10_000,
  });
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const atualizar = () => atualizarAtendimento(qc, empresa.id);
  const rodar = useMutation({
    mutationFn: ({ fn }: { fn: () => Promise<unknown>; ok: string }) => fn(),
    onSuccess: (_r, v) => {
      toast.success(v.ok);
      atualizar();
    },
    onError: (e) => {
      const falta =
        e instanceof ErroPedido && e.codigo === "estoque_insuficiente" ? e.detalhe : undefined;
      toast.error(mensagemDoErroPedido(e), falta ? { description: falta } : undefined);
      atualizar();
    },
  });
  // mutateAsync rejeita em caso de erro: os botões ignoram (o toast já foi mostrado)
  const exec = (fn: () => Promise<unknown>, ok: string) => rodar.mutateAsync({ fn, ok });

  const acoes: AcoesPedido = {
    ocupado: rodar.isPending,
    confirmar: (p) => exec(() => confirmarPedido(p.id), "Pedido confirmado."),
    rejeitar: (p, m) => exec(() => rejeitarPedido(p.id, m), "Pedido rejeitado."),
    entregarPedido: (p) => exec(() => entregarPedido(p.id), "Itens entregues."),
    entregarItem: (id) => exec(() => entregarItens([id]), "Item entregue."),
    cancelarItem: (id, m) => exec(() => cancelarItem(id, m), "Item cancelado."),
  };

  const grupos = useMemo(() => agruparPedidos(consulta.data ?? []), [consulta.data]);
  const estado = estadoDaConsulta(consulta);

  return (
    <>
      <PageHeader
        titulo="Pedidos"
        descricao="Confirme os pedidos, marque as entregas (o estoque baixa na entrega) e cancele itens que faltarem."
      />
      {estado ?? (
        <Tabs defaultValue="pendentes">
          <TabsList>
            <TabsTrigger value="pendentes">Pendentes ({grupos.pendentes.length})</TabsTrigger>
            <TabsTrigger value="andamento">A entregar ({grupos.andamento.length})</TabsTrigger>
            <TabsTrigger value="encerrados">Encerrados</TabsTrigger>
          </TabsList>
          {(
            [
              ["pendentes", "Nenhum pedido pendente", "Novos pedidos dos clientes aparecem aqui."],
              [
                "andamento",
                "Nada aguardando entrega",
                "Pedidos confirmados com itens por entregar aparecem aqui.",
              ],
              [
                "encerrados",
                "Nenhum pedido encerrado",
                "Entregues, recusados e cancelados ficam aqui.",
              ],
            ] as const
          ).map(([g, titulo, texto]) => (
            <TabsContent key={g} value={g} className="mt-4">
              {grupos[g].length === 0 ? (
                <EmptyState icone={Inbox} titulo={titulo} texto={texto} />
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {grupos[g].map((p) => (
                    <PedidoPainelCard key={p.id} pedido={p} agora={agora} acoes={acoes} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  );
}
