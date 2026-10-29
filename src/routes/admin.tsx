import { useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings,
  Tags,
  UtensilsCrossed,
  ClipboardList,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/app/common";
import { useDados } from "@/lib/store";
import { authService } from "@/lib/auth/servico";
import { useGuardaAdmin } from "@/lib/auth/use-sessao";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const itens = [
  { to: "/admin", rotulo: "Dashboard", icone: LayoutDashboard, exato: true },
  { to: "/admin/mesas", rotulo: "Mesas", icone: UtensilsCrossed },
  { to: "/admin/pedidos", rotulo: "Pedidos", icone: ClipboardList },
  { to: "/admin/contas", rotulo: "Contas e pagamentos", icone: ReceiptText },
  { to: "/admin/produtos", rotulo: "Produtos", icone: Package },
  { to: "/admin/categorias", rotulo: "Categorias", icone: Tags },
  { to: "/admin/historico", rotulo: "Histórico de vendas", icone: History },
  { to: "/admin/configuracoes", rotulo: "Configurações", icone: Settings },
] as const;

function Navegacao({ pendentes, onNavegar }: { pendentes: number; onNavegar?: () => void }) {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();
  return (
    <nav className="flex h-full flex-col gap-1 p-3" aria-label="Menu do painel">
      {itens.map((i) => {
        const ativo = "exato" in i ? caminho === i.to || caminho === i.to + "/" : caminho.startsWith(i.to);
        return (
          <Link
            key={i.to}
            to={i.to}
            onClick={onNavegar}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              ativo ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <i.icone className={cn("h-4 w-4", ativo && "text-link")} />
            <span className="flex-1">{i.rotulo}</span>
            {i.to === "/admin/pedidos" && pendentes > 0 && (
              <span className="rounded-full bg-warning px-2 text-xs font-semibold text-warning-foreground">{pendentes}</span>
            )}
          </Link>
        );
      })}
      <button
        onClick={async () => {
          await authService.sair();
          nav({ to: "/admin/login" });
        }}
        className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
      >
        <LogOut className="h-4 w-4" /> Sair do painel
      </button>
    </nav>
  );
}

function AdminLayout() {
  const d = useDados();
  const nav = useNavigate();
  const { liberado } = useGuardaAdmin();
  const [menuAberto, setMenuAberto] = useState(false);

  if (!d || !liberado) return <Carregando />;
  const pendentes = d.pedidos.filter((p) => p.status === "pendente").length;
  const marca = (
    <div className="flex items-center gap-2 px-6 py-5">
      <div className="h-2.5 w-2.5 rounded-full bg-primary" />
      <span className="truncate font-display font-semibold">{d.config.nomeEstabelecimento}</span>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col border-r bg-sidebar lg:flex">
        {marca}
        <Navegacao pendentes={pendentes} />
      </aside>
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b bg-sidebar/95 px-3 py-2 backdrop-blur lg:hidden">
        <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            {marca}
            <Navegacao pendentes={pendentes} onNavegar={() => setMenuAberto(false)} />
          </SheetContent>
        </Sheet>
        <span className="truncate font-display font-semibold">{d.config.nomeEstabelecimento}</span>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/pedidos">
            <ClipboardList className="h-4 w-4" />
            {pendentes > 0 && <span className="text-warning">{pendentes}</span>}
          </Link>
        </Button>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
