import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { FormNovaSenha } from "@/components/auth/FormNovaSenha";
import { authService } from "@/lib/auth/servico";
import { destinoInicial, useSessao } from "@/lib/auth/use-sessao";
import type { ResultadoAuth } from "@/lib/auth/tipos";

export const Route = createFileRoute("/admin_/primeiro-acesso")({
  head: () => ({
    meta: [
      { title: "Primeiro acesso — Mesa Digital" },
      { name: "description", content: "Crie sua senha pessoal para continuar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrimeiroAcesso,
});

function PrimeiroAcesso() {
  const nav = useNavigate();
  const { carregando, sessao } = useSessao();

  useEffect(() => {
    if (carregando) return;
    if (!sessao) nav({ to: "/admin/login", replace: true });
    else if (!sessao.deveTrocarSenha) nav({ to: destinoInicial(sessao), replace: true });
  }, [carregando, sessao, nav]);

  const enviar = async (senha: string, senhaAtual?: string): Promise<ResultadoAuth> => {
    const r = await authService.definirNovaSenha(senha, senhaAtual);
    if (r.ok) nav({ to: sessao ? destinoInicial({ ...sessao, deveTrocarSenha: false }) : "/admin", replace: true });
    return r;
  };

  if (carregando || !sessao?.deveTrocarSenha) {
    return (
      <AuthShell titulo="Primeiro acesso">
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando…
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Crie sua senha"
      descricao="Você entrou com uma senha provisória. Crie uma senha pessoal para continuar."
    >
      <FormNovaSenha rotuloBotao="Salvar e continuar" onEnviar={enviar} pedirSenhaAtual />
    </AuthShell>
  );
}
