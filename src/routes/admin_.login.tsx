import { createFileRoute } from "@tanstack/react-router";
import { TelaLogin } from "@/components/auth/TelaLogin";

export const Route = createFileRoute("/admin_/login")({
  validateSearch: (s: Record<string, unknown>): { aviso?: "senha-redefinida" } =>
    s["aviso"] === "senha-redefinida" ? { aviso: "senha-redefinida" } : {},
  head: () => ({
    meta: [
      { title: "Comanda Fácil - Administrador" },
      { name: "description", content: "Acesse o painel administrativo da Comanda Fácil." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

function Login() {
  const { aviso } = Route.useSearch();
  return (
    <TelaLogin
      aviso={aviso}
      titulo="Acesse o painel"
      descricao="Entre com o e-mail e a senha do administrador."
    />
  );
}
