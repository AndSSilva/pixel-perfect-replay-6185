import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Carregando } from "@/components/app/common";
import { useDados } from "@/lib/store";
import { entrarDemo } from "@/lib/auth-demo";

export const Route = createFileRoute("/admin_/login")({
  head: () => ({
    meta: [
      { title: "Acesso ao painel — Gestão de Bebidas" },
      { name: "description", content: "Entre no painel administrativo com o PIN de demonstração." },
      { property: "og:title", content: "Acesso ao painel — Gestão de Bebidas" },
      { property: "og:description", content: "Entre no painel administrativo com o PIN de demonstração." },
    ],
  }),
  component: Login,
});

function Login() {
  const d = useDados();
  const nav = useNavigate();
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState<string>();
  if (!d) return <Carregando />;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    // Demo-only check against a locally stored PIN. Not real authentication.
    if (pin !== d.config.pinDemo) return setErro("PIN incorreto.");
    entrarDemo();
    nav({ to: "/admin" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={enviar} className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-primary/15 p-2.5">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Painel administrativo</h1>
            <p className="text-sm text-muted-foreground">{d.config.nomeEstabelecimento}</p>
          </div>
        </div>
        <Campo id="pin" rotulo="PIN" erro={erro}>
          <Input
            id="pin"
            inputMode="numeric"
            type="password"
            autoFocus
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              setErro(undefined);
            }}
            maxLength={8}
            aria-invalid={!!erro}
          />
        </Campo>
        <Button type="submit" className="mt-4 w-full" disabled={!pin}>
          Entrar
        </Button>
        <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Acesso demonstrativo, sem segurança real. PIN de teste: <strong className="text-foreground">{d.config.pinDemo === "1234" ? "1234" : "definido nas configurações"}</strong>
        </p>
        <Link to="/" className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">
          Voltar ao início
        </Link>
      </form>
    </main>
  );
}
