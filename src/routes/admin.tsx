import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
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
import { Carregando, EmptyState } from "@/components/app/common";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { EscolherEmpresa } from "@/components/empresa/EscolherEmpresa";
import { useDados } from "@/lib/store";
import type { AppData } from "@/lib/types";
import type { SessaoAdmin } from "@/lib/auth/tipos";
import { useEmpresaAtual } from "@/lib/empresa/atual";
import { EmpresaProvider } from "@/lib/empresa/contexto";
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

/** Áreas do painel já ligadas ao banco; as demais ainda usam os dados de demonstração do MVP. */
const ROTAS_NO_BANCO = ["/admin/categorias", "/admin/mesas", "/admin/produtos"];

function Navegacao({
  pendentes,
  onNavegar,
  trocarEmpresa,
}: {
  pendentes: number;
  onNavegar?: () => void;
  trocarEmpresa?: { rotulo: string; aoClicar: () => void } | undefined;
}) {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();
  return (
    <nav className="flex h-full flex-col gap-1 p-3" aria-label="Menu do painel">
      {itens.map((i) => {
        const ativo =
          "exato" in i ? caminho === i.to || caminho === i.to + "/" : caminho.startsWith(i.to);
        return (
          <Link
            key={i.to}
            to={i.to}
            onClick={onNavegar}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              ativo
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <i.icone className={cn("h-4 w-4", ativo && "text-link")} />
            <span className="flex-1">{i.rotulo}</span>
            {i.to === "/admin/pedidos" && pendentes > 0 && (
              <span className="rounded-full bg-warning px-2 text-xs font-semibold text-warning-foreground">
                {pendentes}
              </span>
            )}
          </Link>
        );
      })}
      <div className="mt-auto space-y-1">
        {trocarEmpresa && (
          <button
            onClick={() => {
              onNavegar?.();
              trocarEmpresa.aoClicar();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <ArrowLeftRight className="h-4 w-4" /> {trocarEmpresa.rotulo}
          </button>
        )}
        <div className="px-3 py-1">
          <ThemeToggle />
        </div>
        <button
          onClick={async () => {
            await authService.sair();
            nav({ to: "/admin/login" });
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sair do painel
        </button>
      </div>
    </nav>
  );
}

function AdminLayout() {
  const d = useDados();
  const { liberado, sessao } = useGuardaAdmin();
  if (!d || !liberado || !sessao) return <Carregando />;
  return <AdminComEmpresa d={d} sessao={sessao} />;
}

/** Só renderiza depois do login; garante que há uma empresa escolhida antes de mostrar o painel. */
function AdminComEmpresa({ d, sessao }: { d: AppData; sessao: SessaoAdmin }) {
  const nav = useNavigate();
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const [menuAberto, setMenuAberto] = useState(false);
  const ctx = useEmpresaAtual(sessao.usuarioId, sessao.papel);
  const ehMaster = sessao.papel === "master";

  // O master escolhe a empresa no cadastro da plataforma (/master).
  useEffect(() => {
    if (!ctx.carregando && !ctx.erro && !ctx.atual && ehMaster)
      nav({ to: "/master", replace: true });
  }, [ctx.carregando, ctx.erro, ctx.atual, ehMaster, nav]);

  const sair = async () => {
    await authService.sair();
    nav({ to: "/admin/login" });
  };

  if (ctx.carregando) return <Carregando />;
  if (ctx.erro) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <EmptyState
          icone={ArrowLeftRight}
          titulo="Não foi possível carregar suas empresas"
          texto="Verifique sua conexão e tente novamente."
          acao={<Button onClick={() => void ctx.recarregar()}>Tentar novamente</Button>}
        />
      </div>
    );
  }
  if (!ctx.atual) {
    if (ehMaster) return <Carregando />;
    if (ctx.empresas.length === 0) {
      return (
        <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
          <EmptyState
            icone={ArrowLeftRight}
            titulo="Nenhuma empresa vinculada"
            texto="Seu acesso ainda não está vinculado a nenhuma empresa ativa. Fale com o administrador da plataforma."
            acao={
              <Button variant="outline" onClick={sair}>
                Sair
              </Button>
            }
          />
        </div>
      );
    }
    return <EscolherEmpresa empresas={ctx.empresas} onEscolher={ctx.escolher} onSair={sair} />;
  }

  const empresa = ctx.atual;
  const naoMigrada = !ROTAS_NO_BANCO.some((r) => caminho === r || caminho === `${r}/`);
  const trocarEmpresa = ehMaster
    ? {
        rotulo: "Voltar à plataforma",
        aoClicar: () => {
          ctx.limpar();
          nav({ to: "/master" });
        },
      }
    : ctx.empresas.length > 1
      ? { rotulo: "Trocar de empresa", aoClicar: ctx.limpar }
      : undefined;

  const pendentes = d.pedidos.filter((p) => p.status === "pendente").length;
  const marca = (
    <div className="flex items-center gap-2 px-6 py-5">
      <div className="h-2.5 w-2.5 rounded-full bg-primary" />
      <span className="truncate font-display font-semibold">{empresa.nome}</span>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col border-r bg-sidebar lg:flex">
        {marca}
        <Navegacao pendentes={pendentes} trocarEmpresa={trocarEmpresa} />
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
            <Navegacao
              pendentes={pendentes}
              onNavegar={() => setMenuAberto(false)}
              trocarEmpresa={trocarEmpresa}
            />
          </SheetContent>
        </Sheet>
        <span className="truncate font-display font-semibold">{empresa.nome}</span>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/pedidos">
            <ClipboardList className="h-4 w-4" />
            {pendentes > 0 && <span className="text-warning">{pendentes}</span>}
          </Link>
        </Button>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        {naoMigrada && (
          <p
            role="note"
            className="mb-4 rounded-md border border-info/40 bg-info/10 px-3 py-2 text-sm text-info"
          >
            Esta área ainda usa dados de demonstração guardados neste navegador e será conectada ao
            banco em uma próxima etapa.
          </p>
        )}
        <EmpresaProvider empresa={empresa}>
          <Outlet />
        </EmpresaProvider>
      </main>
    </div>
  );
}
