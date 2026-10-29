import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTema } from "@/lib/use-tema";

/**
 * Botão único que oferece o tema oposto ao atual: de dia mostra "Modo noite", de noite "Modo dia".
 * O padrão é automático pelo horário; a troca vale até a próxima virada (06:00/18:00).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { tema, alternar } = useTema();
  const paraNoite = tema === "claro";
  const rotulo = paraNoite ? "Mudar para o modo noite" : "Mudar para o modo dia";
  const Icone = paraNoite ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={alternar}
      title={rotulo}
      aria-label={rotulo}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border bg-card px-3 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground",
        className,
      )}
    >
      <Icone className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{paraNoite ? "Modo noite" : "Modo dia"}</span>
    </button>
  );
}
