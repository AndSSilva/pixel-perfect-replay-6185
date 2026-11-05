import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ORDEM_EXIBICAO,
  grupoVazio,
  nomeDoDia,
  type ErrosHorarioForm,
  type GrupoForm,
  type HorarioForm,
} from "@/lib/empresa/horarios";

const CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/** Linha "dias da semana + abre às / fecha às" de um horário. */
function GrupoLinha({
  rotulo,
  grupo,
  ocupados,
  erro,
  onChange,
  onRemover,
}: {
  rotulo: string;
  grupo: GrupoForm;
  /** Dias já usados em outro horário (não podem ser marcados aqui). */
  ocupados: ReadonlySet<number>;
  erro: string | undefined;
  onChange: (g: GrupoForm) => void;
  onRemover?: (() => void) | undefined;
}) {
  const alternar = (dia: number) =>
    onChange({
      ...grupo,
      dias: grupo.dias.includes(dia) ? grupo.dias.filter((d) => d !== dia) : [...grupo.dias, dia],
    });
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{rotulo}</p>
        {onRemover ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRemover}>
            <Trash2 className="h-4 w-4" aria-hidden /> Remover
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Dias — ${rotulo}`}>
        {ORDEM_EXIBICAO.map((dia) => {
          const marcado = grupo.dias.includes(dia);
          const bloqueado = !marcado && ocupados.has(dia);
          return (
            <button
              key={dia}
              type="button"
              aria-pressed={marcado}
              aria-label={nomeDoDia(dia)}
              disabled={bloqueado}
              onClick={() => alternar(dia)}
              className={`h-9 min-w-12 rounded-md border px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                marcado
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {CURTO[dia]}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Abre às</span>
        <Input
          type="time"
          aria-label={`${rotulo}: abre às`}
          className="w-28"
          value={grupo.abre}
          onChange={(e) => onChange({ ...grupo, abre: e.target.value })}
        />
        <span className="text-muted-foreground">Fecha às</span>
        <Input
          type="time"
          aria-label={`${rotulo}: fecha às`}
          className="w-28"
          value={grupo.fecha}
          onChange={(e) => onChange({ ...grupo, fecha: e.target.value })}
        />
      </div>
      {erro ? (
        <p className="text-xs text-destructive" role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

/** Horário padrão (dias marcados) e, opcionalmente, um ou mais horários personalizados para outros dias. */
export function HorarioEditor({
  valor,
  erros,
  onChange,
}: {
  valor: HorarioForm;
  erros: ErrosHorarioForm | undefined;
  onChange: (v: HorarioForm) => void;
}) {
  const usadosPor = (excluir: "padrao" | number): Set<number> => {
    const s = new Set<number>();
    if (excluir !== "padrao") valor.padrao.dias.forEach((d) => s.add(d));
    if (valor.personalizado)
      valor.extras.forEach((g, i) => {
        if (i !== excluir) g.dias.forEach((d) => s.add(d));
      });
    return s;
  };
  const trocarExtra = (i: number, g: GrupoForm) =>
    onChange({ ...valor, extras: valor.extras.map((x, j) => (j === i ? g : x)) });

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Horário de atendimento</legend>
      <p className="text-xs text-muted-foreground">
        Marque os dias em que abre e informe o horário. Dias sem marcação ficam como fechado. Se
        fechar depois da meia-noite, informe o horário do dia seguinte (ex.: abre 19:00, fecha
        02:00).
      </p>
      <GrupoLinha
        rotulo="Horário padrão"
        grupo={valor.padrao}
        ocupados={usadosPor("padrao")}
        erro={erros?.padrao}
        onChange={(padrao) => onChange({ ...valor, padrao })}
      />
      <label className="flex items-center gap-3 text-sm">
        <Switch
          checked={valor.personalizado}
          onCheckedChange={(on) =>
            onChange({
              ...valor,
              personalizado: on,
              extras: on && valor.extras.length === 0 ? [grupoVazio()] : valor.extras,
            })
          }
        />
        <span>
          Horário personalizado
          <span className="block text-xs text-muted-foreground">
            Para dias com horário diferente do padrão.
          </span>
        </span>
      </label>
      {valor.personalizado ? (
        <div className="space-y-3">
          {valor.extras.map((g, i) => (
            <GrupoLinha
              key={i}
              rotulo={`Horário personalizado ${i + 1}`}
              grupo={g}
              ocupados={usadosPor(i)}
              erro={erros?.extras[i]}
              onChange={(novo) => trocarExtra(i, novo)}
              onRemover={() => {
                const extras = valor.extras.filter((_, j) => j !== i);
                onChange({ ...valor, extras, personalizado: extras.length > 0 });
              }}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...valor, extras: [...valor.extras, grupoVazio()] })}
          >
            <Plus className="h-4 w-4" aria-hidden /> Adicionar outro horário
          </Button>
        </div>
      ) : null}
    </fieldset>
  );
}
