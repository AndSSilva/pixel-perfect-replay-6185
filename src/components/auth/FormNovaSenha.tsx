import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/app/common";
import { CampoSenha } from "@/components/auth/CampoSenha";
import { mensagemAuth } from "@/lib/auth/mensagens";
import type { ResultadoAuth } from "@/lib/auth/tipos";
import { criarEsquemaNovaSenha, REQUISITOS_SENHA, type DadosNovaSenha } from "@/lib/auth/validacao";
import { cn } from "@/lib/utils";

/**
 * Formulário de nova senha (recuperação e primeiro acesso).
 * `pedirSenhaAtual` acrescenta o campo da senha atual (provisória), exigido no primeiro acesso.
 */
export function FormNovaSenha({
  rotuloBotao,
  onEnviar,
  pedirSenhaAtual = false,
}: {
  rotuloBotao: string;
  onEnviar: (senha: string, senhaAtual?: string) => Promise<ResultadoAuth>;
  pedirSenhaAtual?: boolean;
}) {
  const [erroGeral, setErroGeral] = useState<string>();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<DadosNovaSenha>({
    resolver: zodResolver(criarEsquemaNovaSenha(pedirSenhaAtual)),
    defaultValues: { senhaAtual: "", senha: "", confirmacao: "" },
  });
  const senha = useWatch({ control, name: "senha" }) ?? "";

  const enviar = handleSubmit(async ({ senha, senhaAtual }) => {
    setErroGeral(undefined);
    const r = await onEnviar(senha, pedirSenhaAtual ? senhaAtual : undefined).catch(
      (): ResultadoAuth => ({ ok: false, codigo: "rede" }),
    );
    if (!r.ok) setErroGeral(mensagemAuth(r.codigo));
  });

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {pedirSenhaAtual && (
        <Campo id="senhaAtual" rotulo="Senha atual (provisória)" erro={errors.senhaAtual?.message}>
          <CampoSenha
            id="senhaAtual"
            autoComplete="current-password"
            autoFocus
            aria-invalid={!!errors.senhaAtual}
            {...register("senhaAtual")}
          />
        </Campo>
      )}
      <Campo id="senha" rotulo="Nova senha" erro={errors.senha?.message}>
        <CampoSenha
          id="senha"
          autoComplete="new-password"
          autoFocus={!pedirSenhaAtual}
          aria-invalid={!!errors.senha}
          aria-describedby="requisitos"
          {...register("senha")}
        />
      </Campo>
      <ul id="requisitos" className="space-y-1 text-xs" aria-label="Requisitos da senha">
        {REQUISITOS_SENHA.map((r) => {
          const ok = r.ok(senha);
          return (
            <li
              key={r.id}
              className={cn(
                "flex items-center gap-1.5",
                ok ? "text-success" : "text-muted-foreground",
              )}
            >
              {ok ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Circle className="h-3.5 w-3.5" aria-hidden />
              )}
              {r.rotulo}
              <span className="sr-only">{ok ? " (atendido)" : " (pendente)"}</span>
            </li>
          );
        })}
      </ul>
      <Campo id="confirmacao" rotulo="Confirme a nova senha" erro={errors.confirmacao?.message}>
        <CampoSenha
          id="confirmacao"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmacao}
          {...register("confirmacao")}
        />
      </Campo>
      {erroGeral && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {erroGeral}
        </p>
      )}
      <Button type="submit" className="h-11 w-full text-base" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
        {rotuloBotao}
      </Button>
    </form>
  );
}
