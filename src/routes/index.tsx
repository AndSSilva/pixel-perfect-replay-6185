import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mesa Digital — Mesas, pedidos e contas" },
      {
        name: "description",
        content:
          "Cardápio por QR Code, pedidos com confirmação e contas individuais para bares e restaurantes.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-link">Mesa Digital</p>
      <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">Mesas, pedidos e contas</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Cardápio por QR Code, pedidos com confirmação do atendente e contas individuais por cliente.
      </p>
      <div className="mt-8">
        <Link
          to="/admin"
          className="group inline-flex items-center gap-3 rounded-xl border bg-card p-5 transition-colors hover:border-primary/50"
        >
          <LayoutDashboard className="h-6 w-6 text-link" />
          <span>
            <span className="block text-lg font-semibold">Painel administrativo</span>
            <span className="block text-sm text-muted-foreground">
              Acesso restrito a administradores.
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-link transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </main>
  );
}
