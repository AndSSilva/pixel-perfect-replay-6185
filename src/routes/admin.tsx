import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeftRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/app/BrandLogo";
import { Carregando, EmptyState } from "@/components/app/common";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { EscolherEmpresa } from "@/components/empresa/EscolherEmpresa";
import type { SessaoAdmin } from "@/lib/auth/tipos";
import { useEmpresaAtual } from "@/lib/empresa/atual";
import { EmpresaProvider } from "@/lib/empresa/contexto";
import { authService } from "@/lib/auth/servico";
import { chavePendentes, contarPendentes } from "@/lib/pedidos/servico-painel";
import { useGuardaAdmin } from "@/lib/auth/use-sessao";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const itens = [
  { to: "/admin", rotulo: "Dashboard", exato: true },
  { to: "/admin/mesas", rotulo: "Mesas", exato: false },
  { to: "/admin/pedidos", rotulo: "Pedidos", exato: false },
  { to: "/admin/contas", rotulo: "Contas e pagamentos", exato: false },
  { to: "/admin/produtos", rotulo: "Produtos", exato: false },
  { to: "/admin/categorias", rotulo: "Categorias", exato: false },
  { to: "/admin/historico", rotulo: "Histórico de vendas", exato: false },
  { to: "/admin/configuracoes", rotulo: "Configurações", exato: false },
] as const;

/** Menu em abas, no mesmo padrão do painel do master (rola para o lado em telas estreitas). */
function Abas({ pendentes }: { pendentes: number }) {
  return (
    <nav aria-label="Menu do painel" className="no-print border-b bg-card px-4 sm:px-8">
      <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto">
        {itens.map((i) => (
          <li key={i.to} className="shrink-0">
            <Link
              to={i.to}
              activeOptions={{ exact: i.exato }}
              className="inline-flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[status=active]:border-primary data-[status=active]:text-foreground"
            >
              {i.rotulo}
              {i.to === "/admin/pedidos" && pendentes > 0 && (
                <span className="rounded-full bg-warning px-2 text-xs font-semibold text-warning-foreground">
                  {pendentes}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function AdminLayout() {
  const { liberado, sessao } = useGuardaAdmin();
  if (!liberado || !sessao) return <Carregando />;
  return <AdminComEmpresa sessao={sessao} />;
}

/** Só renderiza depois do login; garante que há uma empresa escolhida antes de mostrar o painel. */
function AdminComEmpresa({ sessao }: { sessao: SessaoAdmin }) {
  const nav = useNavigate();
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const ctx = useEmpresaAtual(sessao.usuarioId, sessao.papel);
  const ehMaster = sessao.papel === "master";
  const empresaId = ctx.atual?.id ?? null;
  const pendentesQuery = useQuery({
    queryKey: chavePendentes(empresaId ?? ""),
    queryFn: () => contarPendentes(empresaId as string),
    enabled: empresaId !== null,
    refetchInterval: 15_000,
  });

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

  const pendentes = pendentesQuery.data ?? 0;
  return (
    <div className="min-h-screen bg-background">
      <header className="no-print flex items-center justify-between gap-3 border-b bg-card px-4 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <BrandLogo largura={130} className="shrink-0" />
          <span className="flex min-w-0 items-center gap-2 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
            <span className="max-w-[9rem] truncate sm:max-w-[16rem]">{empresa.nome}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {trocarEmpresa && (
            <Button variant="ghost" size="sm" onClick={trocarEmpresa.aoClicar}>
              <ArrowLeftRight className="h-4 w-4" aria-hidden />
              <span className="hidden md:inline">{trocarEmpresa.rotulo}</span>
              <span className="sr-only md:hidden">{trocarEmpresa.rotulo}</span>
            </Button>
          )}
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={sair}>
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Sair</span>
            <span className="sr-only sm:hidden">Sair</span>
          </Button>
        </div>
      </header>
      <Abas pendentes={pendentes} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <EmpresaProvider empresa={empresa}>
          <Outlet />
        </EmpresaProvider>
      </main>
    </div>
  );
}
