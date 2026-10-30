import { Building2, ChevronRight, LogOut } from "lucide-react";
import { BrandLogo } from "@/components/app/BrandLogo";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Selo } from "@/components/app/common";
import type { Empresa } from "@/lib/empresa/tipos";

/** Tela para o administrador (com mais de uma empresa) escolher qual vai gerir. */
export function EscolherEmpresa({
  empresas,
  onEscolher,
  onSair,
}: {
  empresas: readonly Empresa[];
  onEscolher: (id: string) => void;
  onSair: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <BrandLogo largura={150} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={onSair}>
            <LogOut className="h-4 w-4" aria-hidden /> Sair
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Escolha a empresa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione qual empresa você vai gerenciar agora.
        </p>
        <ul className="mt-6 space-y-3">
          {empresas.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onEscolher(e.id)}
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50"
              >
                <span className="rounded-lg bg-primary/10 p-2.5 text-link">
                  <Building2 className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.nome}</span>
                  <span className="block truncate text-xs text-muted-foreground">/{e.slug}</span>
                </span>
                {!e.ativo && <Selo tom="neutro">Inativa</Selo>}
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
