import type { ReactNode } from "react";
import { BrandLogo } from "@/components/app/BrandLogo";
import { ThemeToggle } from "@/components/app/ThemeToggle";

/** Moldura das telas de acesso do painel: marca INOV4 HUB, tema e cartão central. */
export function AuthShell({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-40"
        style={{
          background:
            "radial-gradient(60rem 30rem at 85% -10%, color-mix(in srgb, var(--conector) 18%, transparent), transparent 60%), radial-gradient(50rem 28rem at 0% 110%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 60%)",
        }}
      />
      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8">
        <BrandLogo largura={150} />
        <ThemeToggle />
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10 pt-2">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border bg-card p-6 shadow-xl shadow-slate-900/5 sm:p-8">
            <h1 className="font-display text-2xl font-bold tracking-tight">{titulo}</h1>
            {descricao && <p className="mt-1.5 text-sm text-muted-foreground">{descricao}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {rodape && <div className="mt-5 text-center text-sm text-muted-foreground">{rodape}</div>}
        </div>
      </main>
      <footer className="relative z-10 px-4 pb-6 text-center text-xs text-muted-foreground">
        Mesa Digital · uma solução INOV4 HUB
      </footer>
    </div>
  );
}
