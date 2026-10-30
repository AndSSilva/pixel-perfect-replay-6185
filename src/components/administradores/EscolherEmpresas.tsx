import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Empresa } from "@/lib/empresa/tipos";

/** Lista de empresas com caixas de seleção (para vincular um administrador). */
export function EscolherEmpresas({
  empresas,
  selecionadas,
  onMudar,
  idBase,
}: {
  empresas: readonly Empresa[];
  selecionadas: readonly string[];
  onMudar: (ids: string[]) => void;
  idBase: string;
}) {
  if (empresas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada ainda.</p>;
  }
  const alternar = (id: string, marcado: boolean) =>
    onMudar(marcado ? [...new Set([...selecionadas, id])] : selecionadas.filter((x) => x !== id));
  return (
    <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
      {empresas.map((e) => {
        const id = `${idBase}-${e.id}`;
        return (
          <li
            key={e.id}
            className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/60"
          >
            <Checkbox
              id={id}
              checked={selecionadas.includes(e.id)}
              onCheckedChange={(v) => alternar(e.id, v === true)}
            />
            <Label htmlFor={id} className="flex-1 cursor-pointer">
              <span className="block font-medium">{e.nome}</span>
              <span className="block text-xs font-normal text-muted-foreground">
                /{e.slug}
                {!e.ativo && " · inativa"}
              </span>
            </Label>
          </li>
        );
      })}
    </ul>
  );
}
