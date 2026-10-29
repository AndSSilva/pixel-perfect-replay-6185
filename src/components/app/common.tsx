import type { ReactNode } from "react";
import { Beer, CupSoda, GlassWater, Loader2, Martini, Wine, Zap, type LucideIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function PageHeader({ titulo, descricao, acoes }: { titulo: string; descricao?: string | undefined; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Painel({ titulo, acao, children, className }: { titulo?: string | undefined; acao?: ReactNode | undefined; children: ReactNode; className?: string | undefined }) {
  return (
    <section className={cn("rounded-xl border bg-card p-4 sm:p-5", className)}>
      {(titulo || acao) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {titulo && <h2 className="text-base font-semibold">{titulo}</h2>}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ rotulo, valor, icone: Icone, destaque }: { rotulo: string; valor: ReactNode; icone: LucideIcon; destaque?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", destaque && "border-primary/40")}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</span>
        <Icone className={cn("h-4 w-4", destaque ? "text-link" : "text-muted-foreground")} aria-hidden />
      </div>
      <div className="mt-3 font-display text-2xl font-semibold tabular">{valor}</div>
    </div>
  );
}

export function EmptyState({ icone: Icone, titulo, texto, acao }: { icone: LucideIcon; titulo: string; texto?: string | undefined; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center">
      <div className="mb-3 rounded-full bg-muted p-3">
        <Icone className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <p className="font-medium">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{texto}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

type Tom = "sucesso" | "alerta" | "perigo" | "info" | "neutro" | "destaque";
const tons: Record<Tom, string> = {
  sucesso: "bg-success/15 text-success border-success/30",
  alerta: "bg-warning/15 text-warning border-warning/30",
  perigo: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-info/15 text-info border-info/30",
  neutro: "bg-muted text-muted-foreground border-border",
  destaque: "bg-primary/15 text-link border-primary/30",
};

export function Selo({ tom, children }: { tom: Tom; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", tons[tom])}>
      {children}
    </span>
  );
}

export const seloPedido = { pendente: ["alerta", "Pendente de confirmação"], confirmado: ["sucesso", "Confirmado"], rejeitado: ["perigo", "Rejeitado"] } as const;
export const seloMesa = {
  disponivel: ["sucesso", "Disponível"],
  ocupada: ["destaque", "Ocupada"],
  aguardando: ["alerta", "Aguardando fechamento"],
  inativa: ["neutro", "Desativada"],
} as const;

export function Carregando() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground" role="status">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
    </div>
  );
}

export function Campo({ id, rotulo, erro, children, dica }: { id: string; rotulo: string; erro?: string | undefined; dica?: string | undefined; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
      {dica && !erro && <p className="text-xs text-muted-foreground">{dica}</p>}
      {erro && (
        <p className="text-xs text-destructive" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}

export function Confirmar({
  gatilho,
  titulo,
  descricao,
  rotuloAcao = "Confirmar",
  perigo,
  onConfirmar,
  children,
}: {
  gatilho: ReactNode;
  titulo: string;
  descricao: string;
  rotuloAcao?: string | undefined;
  perigo?: boolean | undefined;
  onConfirmar: () => void;
  children?: ReactNode | undefined;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{gatilho}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmar}
            className={perigo ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {rotuloAcao}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function iconeCategoria(nome?: string): LucideIcon {
  const n = (nome ?? "").toLowerCase();
  if (n.includes("cerve")) return Beer;
  if (n.includes("refri")) return CupSoda;
  if (n.includes("água") || n.includes("agua")) return GlassWater;
  if (n.includes("energ")) return Zap;
  if (n.includes("destil") || n.includes("vinho")) return Wine;
  return Martini;
}
export type Erros = Partial<Record<"nome" | "pin" | "valor" | "recebido" | "categoria" | "preco", string>>;
