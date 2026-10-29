import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/app/common";
import { AuthShell } from "@/components/auth/AuthShell";
import { authService } from "@/lib/auth/servico";
import { mensagemAuth } from "@/lib/auth/mensagens";
import { esquemaEmail, type DadosEmail } from "@/lib/auth/validacao";

export const Route = createFileRoute("/admin_/esqueci-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — Mesa Digital" },
      { name: "description", content: "Receba por e-mail um link para criar uma nova senha." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EsqueciSenha,
});

function EsqueciSenha() {
  const [enviado, setEnviado] = useState(false);
  const [erroGeral, setErroGeral] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DadosEmail>({ resolver: zodResolver(esquemaEmail), defaultValues: { email: "" } });

  const enviar = handleSubmit(async ({ email }) => {
    setErroGeral(undefined);
    const r = await authService
      .solicitarRecuperacao(email, `${window.location.origin}/admin/redefinir-senha`)
      .catch(() => null);
    if (!r) return setErroGeral(mensagemAuth("rede"));
    // Resposta neutra: não revela se o e-mail tem conta. Só falhas gerais (rede, limite) aparecem como erro.
    if (!r.ok) return setErroGeral(mensagemAuth(r.codigo));
    setEnviado(true);
  });

  const voltar = (
    <Link
      to="/admin/login"
      className="inline-flex items-center gap-1 font-medium text-link hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar para o login
    </Link>
  );

  if (enviado) {
    return (
      <AuthShell titulo="Verifique seu e-mail" rodape={voltar}>
        <div role="status" className="flex items-start gap-3 text-sm">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-link" aria-hidden />
          <p>
            Se este e-mail estiver cadastrado, enviaremos um link para criar uma nova senha. Ele
            pode levar alguns minutos; confira também a caixa de spam.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Recuperar senha"
      descricao="Informe o e-mail do administrador e enviaremos um link para criar uma nova senha."
      rodape={voltar}
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        <Campo id="email" rotulo="E-mail" erro={errors.email?.message}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            className="h-11"
            aria-invalid={!!errors.email}
            {...register("email")}
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
          Enviar link
        </Button>
      </form>
    </AuthShell>
  );
}
