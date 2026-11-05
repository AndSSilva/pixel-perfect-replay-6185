import { createFileRoute } from "@tanstack/react-router";
import { TelaLogin } from "@/components/auth/TelaLogin";

// Entrada própria do master. Depois de entrar, o master é levado a /master (quem não é master vai para o
// painel do administrador, pela mesma regra de destino do login).
export const Route = createFileRoute("/master_/login")({
  validateSearch: (s: Record<string, unknown>): { aviso?: "senha-redefinida" } =>
    s["aviso"] === "senha-redefinida" ? { aviso: "senha-redefinida" } : {},
  head: () => ({
    meta: [
      { title: "Comanda Fácil - Master" },
      { name: "description", content: "Acesso da plataforma Comanda Fácil." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginMaster,
});

function LoginMaster() {
  const { aviso } = Route.useSearch();
  return (
    <TelaLogin
      aviso={aviso}
      titulo="Acesse a plataforma"
      descricao="Entre com o e-mail e a senha do master."
    />
  );
}
