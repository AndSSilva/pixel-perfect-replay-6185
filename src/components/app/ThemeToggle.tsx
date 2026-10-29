import { Clock, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTema } from "@/lib/use-tema";
import type { PreferenciaTema } from "@/lib/tema";

const OPCOES: { valor: PreferenciaTema; rotulo: string; Icone: typeof Sun }[] = [
  { valor: "claro", rotulo: "Tema claro", Icone: Sun },
  { valor: "automatico", rotulo: "Tema automático pelo horário", Icone: Clock },
  { valor: "escuro", rotulo: "Tema escuro", Icone: Moon },
];

/** Seletor de tema: claro, automático (padrão, pelo horário) ou escuro. */
export function ThemeToggle({ className }: { className?: string }) {
  const { preferencia, escolher } = useTema();
  return (
    <div
      role="group"
      aria-label="Tema da interface"
      className={cn("inline-flex rounded-full border bg-card p-0.5 shadow-sm", className)}
    >
      {OPCOES.map(({ valor, rotulo, Icone }) => {
        const ativo = preferencia === valor;
        return (
          <button
            key={valor}
            type="button"
            title={rotulo}
            aria-label={rotulo}
            aria-pressed={ativo}
            onClick={() => escolher(valor)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
              ativo
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icone className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
