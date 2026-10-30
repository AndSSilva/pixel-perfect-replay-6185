import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Mostra uma única vez o e-mail e a senha provisória para o master repassar ao administrador. */
export function CredenciaisProvisorias({ email, senha }: { email: string; senha: string }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Acesso ao painel Mesa Digital\nE-mail: ${email}\nSenha provisória: ${senha}\nNo primeiro acesso você vai criar a sua própria senha.`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  return (
    <div className="space-y-4">
      <p
        role="alert"
        className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
      >
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <span>
          Esta senha aparece só agora. Copie e envie ao administrador por um canal seguro; ele
          precisará trocá-la no primeiro acesso.
        </span>
      </p>
      <dl className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">E-mail</dt>
          <dd className="break-all font-medium">{email}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Senha provisória</dt>
          <dd className="select-all break-all font-mono text-base font-semibold tracking-wide">
            {senha}
          </dd>
        </div>
      </dl>
      <Button type="button" variant="outline" className="w-full" onClick={copiar}>
        {copiado ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
        {copiado ? "Copiado" : "Copiar e-mail e senha"}
      </Button>
    </div>
  );
}
