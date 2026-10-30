import { createFileRoute, redirect } from "@tanstack/react-router";

// O login é um só (/admin/login): depois de entrar, o master é levado a /master.
// Este endereço existe só como atalho para quem digitar /master/login.
export const Route = createFileRoute("/master_/login")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/login", replace: true });
  },
});
