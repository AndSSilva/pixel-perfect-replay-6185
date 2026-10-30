import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/app/common";
import { CredenciaisProvisorias } from "@/components/administradores/CredenciaisProvisorias";
import { EscolherEmpresas } from "@/components/administradores/EscolherEmpresas";
import {
  CHAVE_ADMINISTRADORES,
  ErroAdmin,
  criarAdministrador,
} from "@/lib/administradores/servico";
import { MENSAGENS_ADMIN } from "@/lib/administradores/tipos";
import { esquemaNovoAdministrador, gerarSenhaProvisoria } from "@/lib/administradores/validacao";
import type { Empresa } from "@/lib/empresa/tipos";

/** Cria um administrador: e-mail, senha provisória (gerada) e empresas. Mostra a senha uma única vez. */
export function FormNovoAdministrador({
  aberto,
  onFechar,
  empresas,
}: {
  aberto: boolean;
  onFechar: () => void;
  empresas: readonly Empresa[];
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [empresaIds, setEmpresaIds] = useState<string[]>([]);
  const [erroEmail, setErroEmail] = useState<string>();
  const [erroGeral, setErroGeral] = useState<string>();
  const [criado, setCriado] = useState<{ email: string; senha: string } | null>(null);

  useEffect(() => {
    if (aberto) {
      setEmail("");
      setSenha(gerarSenhaProvisoria());
      setEmpresaIds([]);
      setErroEmail(undefined);
      setErroGeral(undefined);
      setCriado(null);
    }
  }, [aberto]);

  const mutacao = useMutation({
    mutationFn: criarAdministrador,
    onSuccess: async (_d, vars) => {
      await qc.invalidateQueries({ queryKey: CHAVE_ADMINISTRADORES });
      setCriado({ email: vars.email, senha: vars.senhaProvisoria });
    },
    onError: (e) => setErroGeral(e instanceof ErroAdmin ? e.message : MENSAGENS_ADMIN.desconhecido),
  });

  const enviar = (ev: React.FormEvent) => {
    ev.preventDefault();
    setErroGeral(undefined);
    const v = esquemaNovoAdministrador.safeParse({ email, senhaProvisoria: senha, empresaIds });
    if (!v.success) {
      setErroEmail(v.error.issues.find((i) => i.path[0] === "email")?.message);
      if (!v.error.issues.some((i) => i.path[0] === "email"))
        setErroGeral(MENSAGENS_ADMIN.dados_invalidos);
      return;
    }
    setErroEmail(undefined);
    mutacao.mutate(v.data);
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !mutacao.isPending && onFechar()}>
      <DialogContent>
        {criado ? (
          <>
            <DialogHeader>
              <DialogTitle>Administrador criado</DialogTitle>
              <DialogDescription>Envie estes dados ao administrador.</DialogDescription>
            </DialogHeader>
            <CredenciaisProvisorias email={criado.email} senha={criado.senha} />
            <DialogFooter>
              <Button onClick={onFechar}>Concluir</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={enviar} noValidate className="space-y-4">
            <DialogHeader>
              <DialogTitle>Novo administrador</DialogTitle>
              <DialogDescription>
                Ele entra com a senha provisória e cria a própria senha no primeiro acesso.
              </DialogDescription>
            </DialogHeader>
            <Campo id="adm-email" rotulo="E-mail" erro={erroEmail}>
              <Input
                id="adm-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!erroEmail}
              />
            </Campo>
            <Campo
              id="adm-senha"
              rotulo="Senha provisória"
              dica="Gerada automaticamente. Você a verá de novo só depois de criar."
            >
              <div className="flex gap-2">
                <Input id="adm-senha" readOnly value={senha} className="font-mono" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Gerar outra senha"
                  onClick={() => setSenha(gerarSenhaProvisoria())}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </Campo>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Empresas que ele vai gerenciar</p>
              <EscolherEmpresas
                empresas={empresas}
                selecionadas={empresaIds}
                onMudar={setEmpresaIds}
                idBase="novo-adm"
              />
              <p className="text-xs text-muted-foreground">Você pode alterar isso depois.</p>
            </div>
            {erroGeral && (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {erroGeral}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onFechar}
                disabled={mutacao.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={mutacao.isPending}>
                {mutacao.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Criar administrador
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
