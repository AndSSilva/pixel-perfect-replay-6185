import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/app/common";
import { PedidoCard } from "@/components/app/PedidoCard";
import { useDados } from "@/lib/store";

export const Route = createFileRoute("/admin/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos — Gestão de Bebidas" },
      { name: "description", content: "Fila de pedidos para confirmação manual." },
      { property: "og:title", content: "Pedidos — Gestão de Bebidas" },
      { property: "og:description", content: "Fila de pedidos para confirmação manual." },
    ],
  }),
  component: Pedidos,
});

function Pedidos() {
  const d = useDados()!;
  const [status, setStatus] = useState("todos");
  const ordenados = [...d.pedidos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const pendentes = ordenados.filter((p) => p.status === "pendente").reverse(); // oldest first in the queue
  const anteriores = ordenados.filter((p) => p.status !== "pendente" && (status === "todos" || p.status === status));

  return (
    <>
      <PageHeader titulo="Pedidos" descricao="Confirme ou rejeite os pedidos enviados pelo cardápio." />
      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes ({pendentes.length})</TabsTrigger>
          <TabsTrigger value="anteriores">Anteriores</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes" className="mt-4">
          {pendentes.length === 0 ? (
            <EmptyState icone={Inbox} titulo="Nenhum pedido pendente" texto="Novos pedidos do cardápio aparecerão aqui para confirmação." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">{pendentes.map((p) => <PedidoCard key={p.id} d={d} pedido={p} />)}</div>
          )}
        </TabsContent>
        <TabsContent value="anteriores" className="mt-4 space-y-4">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-56" aria-label="Filtrar por situação"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Confirmados e rejeitados</SelectItem>
              <SelectItem value="confirmado">Somente confirmados</SelectItem>
              <SelectItem value="rejeitado">Somente rejeitados</SelectItem>
            </SelectContent>
          </Select>
          {anteriores.length === 0 ? (
            <EmptyState icone={Inbox} titulo="Nenhum pedido anterior" />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">{anteriores.map((p) => <PedidoCard key={p.id} d={d} pedido={p} />)}</div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
