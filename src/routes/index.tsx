import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, LayoutDashboard, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDados } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mesa Digital — Mesas, pedidos e contas" },
      { name: "description", content: "Painel para comercial de bebidas: cardápio por QR Code, pedidos com confirmação e contas individuais." },
      { property: "og:title", content: "Mesa Digital — Mesas, pedidos e contas" },
      { property: "og:description", content: "Cardápio por QR Code, confirmação de pedidos e fechamento de contas individuais." },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const d = useDados();
  const mesas = d?.mesas.filter((m) => m.ativa) ?? [];
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-link">Mesa Digital</p>
      <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{d?.config.nomeEstabelecimento ?? "Mesa Digital"}</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Mesas, cardápio por QR Code, pedidos com confirmação manual e contas individuais. Os dados ficam salvos apenas neste navegador.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link to="/admin" className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary/50">
          <LayoutDashboard className="h-6 w-6 text-link" />
          <h2 className="mt-4 text-lg font-semibold">Painel administrativo</h2>
          <p className="mt-1 text-sm text-muted-foreground">Acesso restrito a administradores.</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-link">
            Entrar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
        <div className="rounded-xl border bg-card p-5">
          <QrCode className="h-6 w-6 text-link" />
          <h2 className="mt-4 text-lg font-semibold">Cardápio do cliente</h2>
          <p className="mt-1 text-sm text-muted-foreground">Simule o acesso pelo QR Code de uma mesa:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {mesas.map((m) => (
              <Button key={m.id} asChild size="sm" variant="secondary">
                <Link to="/cardapio/$mesaId" params={{ mesaId: m.id }}>
                  {m.nome}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
