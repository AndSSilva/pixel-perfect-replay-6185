import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/app/BrandLogo";
import { Carregando } from "@/components/app/common";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { Button } from "@/components/ui/button";
import { authService } from "@/lib/auth/servico";
import { useGuardaMaster } from "@/lib/auth/use-sessao";

export const Route = createFileRoute("/master")({
  head: () => ({
    meta: [{ title: "Plataforma — Mesa Digital" }, { name: "robots", content: "noindex" }],
  }),
  component: MasterLayout,
});

function MasterLayout() {
  const nav = useNavigate();
  const { liberado, sessao } = useGuardaMaster();
  if (!liberado || !sessao) return <Carregando />;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3 sm:px-8">
        <div className="flex items-center gap-4">
          <Link to="/master" aria-label="Início da plataforma">
            <BrandLogo largura={140} />
          </Link>
          <span className="hidden rounded-full bg-conector/15 px-2.5 py-0.5 text-xs font-semibold text-conector sm:inline">
            Plataforma
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden max-w-[16rem] truncate text-sm text-muted-foreground md:inline">
            {sessao.email}
          </span>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await authService.sair();
              nav({ to: "/admin/login" });
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sair
          </Button>
        </div>
      </header>
      <nav aria-label="Seções da plataforma" className="border-b bg-card px-4 sm:px-8">
        <ul className="mx-auto flex max-w-5xl gap-1">
          {[
            { to: "/master", rotulo: "Empresas", exato: true },
            { to: "/master/administradores", rotulo: "Administradores", exato: false },
          ].map((i) => (
            <li key={i.to}>
              <Link
                to={i.to}
                activeOptions={{ exact: i.exato }}
                className="inline-block border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[status=active]:border-primary data-[status=active]:text-foreground"
              >
                {i.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
