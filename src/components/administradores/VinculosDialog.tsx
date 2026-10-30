import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EscolherEmpresas } from "@/components/administradores/EscolherEmpresas";
import { CHAVE_ADMINISTRADORES, ErroAdmin, definirVinculos } from "@/lib/administradores/servico";
import { MENSAGENS_ADMIN, type AdministradorListado } from "@/lib/administradores/tipos";
import type { Empresa } from "@/lib/empresa/tipos";

/** Escolhe quais empresas um administrador pode gerenciar. */
export function VinculosDialog({
  administrador,
  onFechar,
  empresas,
}: {
  administrador: AdministradorListado | null;
  onFechar: () => void;
  empresas: readonly Empresa[];
}) {
  const qc = useQueryClient();
  const [ids, setIds] = useState<string[]>([]);
  const [erro, setErro] = useState<string>();

  useEffect(() => {
    if (administrador) {
      setIds(administrador.empresas.map((e) => e.id));
      setErro(undefined);
    }
  }, [administrador]);

  const mutacao = useMutation({
    mutationFn: () => definirVinculos(administrador!.usuarioId, ids),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: CHAVE_ADMINISTRADORES });
      toast.success("Empresas atualizadas.");
      onFechar();
    },
    onError: (e) => setErro(e instanceof ErroAdmin ? e.message : MENSAGENS_ADMIN.desconhecido),
  });

  return (
    <Dialog open={!!administrador} onOpenChange={(o) => !o && !mutacao.isPending && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Empresas do administrador</DialogTitle>
          <DialogDescription className="break-all">{administrador?.email}</DialogDescription>
        </DialogHeader>
        <EscolherEmpresas empresas={empresas} selecionadas={ids} onMudar={setIds} idBase="vinc" />
        {erro && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {erro}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={mutacao.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mutacao.mutate()} disabled={mutacao.isPending}>
            {mutacao.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
