import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CredenciaisProvisorias } from "@/components/administradores/CredenciaisProvisorias";
import {
  CHAVE_ADMINISTRADORES,
  ErroAdmin,
  redefinirSenhaProvisoria,
} from "@/lib/administradores/servico";
import { MENSAGENS_ADMIN, type AdministradorListado } from "@/lib/administradores/tipos";
import { gerarSenhaProvisoria } from "@/lib/administradores/validacao";

/** Gera uma nova senha provisória para o administrador (que volta a ter de trocá-la no próximo acesso). */
export function RedefinirSenhaDialog({
  administrador,
  onFechar,
}: {
  administrador: AdministradorListado | null;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const [novaSenha, setNovaSenha] = useState<string | null>(null);
  const [erro, setErro] = useState<string>();

  useEffect(() => {
    if (administrador) {
      setNovaSenha(null);
      setErro(undefined);
    }
  }, [administrador]);

  const mutacao = useMutation({
    mutationFn: (senha: string) =>
      redefinirSenhaProvisoria({ usuarioId: administrador!.usuarioId, senhaProvisoria: senha }),
    onSuccess: async (_d, senha) => {
      await qc.invalidateQueries({ queryKey: CHAVE_ADMINISTRADORES });
      setNovaSenha(senha);
    },
    onError: (e) => setErro(e instanceof ErroAdmin ? e.message : MENSAGENS_ADMIN.desconhecido),
  });

  return (
    <Dialog open={!!administrador} onOpenChange={(o) => !o && !mutacao.isPending && onFechar()}>
      <DialogContent>
        {novaSenha && administrador ? (
          <>
            <DialogHeader>
              <DialogTitle>Nova senha provisória</DialogTitle>
              <DialogDescription>A senha anterior deixou de valer.</DialogDescription>
            </DialogHeader>
            <CredenciaisProvisorias email={administrador.email} senha={novaSenha} />
            <DialogFooter>
              <Button onClick={onFechar}>Concluir</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Gerar nova senha provisória?</DialogTitle>
              <DialogDescription className="break-all">
                {administrador?.email}. A senha atual deixa de valer e, no próximo acesso, a pessoa
                precisará criar uma senha própria. Quem já estiver com o painel aberto continua
                logado até a sessão expirar.
              </DialogDescription>
            </DialogHeader>
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
              <Button
                onClick={() => {
                  setErro(undefined);
                  mutacao.mutate(gerarSenhaProvisoria());
                }}
                disabled={mutacao.isPending}
              >
                {mutacao.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Gerar nova senha
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
