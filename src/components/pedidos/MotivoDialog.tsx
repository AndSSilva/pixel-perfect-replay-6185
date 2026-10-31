import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Pede um motivo (obrigatório ou não) antes de executar uma ação. */
export function MotivoDialog({
  gatilho,
  titulo,
  descricao,
  rotuloAcao,
  obrigatorio,
  ocupado,
  onConfirmar,
}: {
  gatilho: ReactNode;
  titulo: string;
  descricao: string;
  rotuloAcao: string;
  obrigatorio: boolean;
  ocupado?: boolean | undefined;
  onConfirmar: (motivo: string) => Promise<unknown> | void;
}) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const vazio = obrigatorio && motivo.trim() === "";
  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        setAberto(o);
        if (!o) setMotivo("");
      }}
    >
      <DialogTrigger asChild>{gatilho}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="motivo-acao">Motivo{obrigatorio ? "" : " (opcional)"}</Label>
          <Textarea
            id="motivo-acao"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={200}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={vazio || ocupado === true}
            onClick={async () => {
              try {
                await onConfirmar(motivo);
                setAberto(false);
              } catch {
                /* o erro já foi mostrado por quem chamou; mantém o diálogo aberto */
              }
            }}
          >
            {rotuloAcao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
