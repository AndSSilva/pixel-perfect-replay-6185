import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/app/common";
import { AuthShell } from "@/components/auth/AuthShell";
import { CampoSenha } from "@/components/auth/CampoSenha";
import { authService } from "@/lib/auth/servico";
import { mensagemAuth } from "@/lib/auth/mensagens";
import { useSessao } from "@/lib/auth/use-sessao";
import { esquemaLogin, type DadosLogin } from "@/lib/auth/validacao";

export const Route = createFileRoute("/admin_/login")({
  validateSearch: (s: Record<string, unknown>): { aviso?: "senha-redefinida" } =>
    s["aviso"] === "senha-redefinida" ? { aviso: "senha-redefinida" } : {},
  head: () => ({
    meta: [
      { title: "Entrar — Mesa Digital" },
      { name: "description", content: "Acesse o painel administrativo da Mesa Digital." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

function Login() {
  const { aviso } = Route.useSearch();
  const nav = useNavigate();
  const { carregando, sessao } = useSessao();
  const [erroGeral, setErroGeral] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DadosLogin>({
    resolver: zodResolver(esquemaLogin),
    defaultValues: { email: "", senha: "" },
  });

  // Quem já está autenticado não precisa ver o login.
  useEffect(() => {
    if (carregando || !sessao) return;
    nav({ to: sessao.deveTrocarSenha ? "/admin/primeiro-acesso" : "/admin", replace: true });
  }, [carregando, sessao, nav]);

  const entrar = handleSubmit(async ({ email, senha }) => {
    setErroGeral(undefined);
    const r = await authService.entrar(email, senha).catch(() => null);
    if (!r) return setErroGeral(mensagemAuth("rede"));
    if (!r.ok) return setErroGeral(mensagemAuth(r.codigo));
    nav({ to: r.valor.deveTrocarSenha ? "/admin/primeiro-acesso" : "/admin", replace: true });
  });

  return (
    <AuthShell titulo="Acesse o painel" descricao="Entre com o e-mail e a senha do administrador.">
      {aviso === "senha-redefinida" && (
        <p
          role="status"
          className="mb-4 flex items-start gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Senha alterada. Entre com
          a nova senha.
        </p>
      )}
      <form onSubmit={entrar} noValidate className="space-y-4">
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
        <Campo id="senha" rotulo="Senha" erro={errors.senha?.message}>
          <CampoSenha
            id="senha"
            autoComplete="current-password"
            aria-invalid={!!errors.senha}
            {...register("senha")}
          />
        </Campo>
        <div className="flex justify-end">
          <Link to="/admin/esqueci-senha" className="text-sm font-medium text-link hover:underline">
            Esqueci minha senha
          </Link>
        </div>
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
          Entrar
        </Button>
      </form>
    </AuthShell>
  );
}
