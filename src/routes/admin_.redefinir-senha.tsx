import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, TriangleAlert } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { FormNovaSenha } from "@/components/auth/FormNovaSenha";
import { authService } from "@/lib/auth/servico";
import type { ResultadoAuth } from "@/lib/auth/tipos";

export const Route = createFileRoute("/admin_/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Criar nova senha — Mesa Digital" },
      { name: "description", content: "Crie uma nova senha para acessar o painel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const nav = useNavigate();
  const [valido, setValido] = useState<boolean | null>(null);

  useEffect(() => {
    let ativo = true;
    authService
      .linkRecuperacaoValido()
      .then((v) => ativo && setValido(v))
      .catch(() => ativo && setValido(false));
    return () => {
      ativo = false;
    };
  }, []);

  const enviar = async (senha: string): Promise<ResultadoAuth> => {
    const r = await authService.definirNovaSenha(senha);
    if (r.ok) {
      // Por segurança, encerra a sessão de recuperação e pede um login com a nova senha.
      await authService.sair();
      nav({ to: "/admin/login", search: { aviso: "senha-redefinida" }, replace: true });
    }
    return r;
  };

  if (valido === null) {
    return (
      <AuthShell titulo="Criar nova senha">
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Verificando o link…
        </div>
      </AuthShell>
    );
  }

  if (!valido) {
    return (
      <AuthShell titulo="Link inválido ou expirado">
        <div className="space-y-4 text-sm">
          <p className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            Este link não pode mais ser usado. Solicite um novo para criar sua senha.
          </p>
          <Link to="/admin/esqueci-senha" className="font-medium text-link hover:underline">
            Solicitar novo link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Criar nova senha"
      descricao="Escolha uma senha forte que você não use em outros lugares."
    >
      <FormNovaSenha rotuloBotao="Salvar nova senha" onEnviar={enviar} />
    </AuthShell>
  );
}
