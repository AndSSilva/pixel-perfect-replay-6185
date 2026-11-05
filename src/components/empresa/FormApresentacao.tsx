import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HorarioEditor } from "@/components/empresa/HorarioEditor";
import { Campo } from "@/components/app/common";
import { LIMITE_DESCRICAO, LIMITE_ENDERECO } from "@/lib/empresa/apresentacao";
import {
  formParaHorarios,
  formParaIntervalo,
  horariosParaForm,
  instagramValido,
  intervaloParaForm,
  normalizarInstagram,
  normalizarWhatsapp,
  temErrosHorario,
  validarHorarioForm,
  validarIntervalo,
  whatsappValido,
  type ErrosHorarioForm,
  type Horarios,
  type Intervalo,
} from "@/lib/empresa/horarios";
import { ErroEmpresa, MENSAGENS_EMPRESA } from "@/lib/empresa/tipos";

const esquema = z.object({
  descricao: z.string().max(LIMITE_DESCRICAO, `Use no máximo ${LIMITE_DESCRICAO} caracteres.`),
  whatsapp: z
    .string()
    .refine(
      (v) => v.trim() === "" || whatsappValido(normalizarWhatsapp(v)),
      "Informe DDD e número, ex.: (51) 93500-1383.",
    ),
  instagram: z
    .string()
    .refine(
      (v) => v.trim() === "" || instagramValido(normalizarInstagram(v)),
      "Use só o nome de usuário, ex.: nevoa.lounge.",
    ),
  endereco: z.string().max(LIMITE_ENDERECO, `Use no máximo ${LIMITE_ENDERECO} caracteres.`),
  horario: z
    .object({
      padrao: z.object({ dias: z.array(z.number()), abre: z.string(), fecha: z.string() }),
      personalizado: z.boolean(),
      extras: z.array(z.object({ dias: z.array(z.number()), abre: z.string(), fecha: z.string() })),
    })
    .superRefine((f, ctx) => {
      const e = validarHorarioForm(f);
      if (!temErrosHorario(e)) return;
      if (e.padrao) ctx.addIssue({ code: "custom", message: e.padrao, path: ["padrao"] });
      for (const [i, msg] of Object.entries(e.extras))
        ctx.addIssue({ code: "custom", message: msg, path: ["extras", Number(i)] });
    }),
  intervalo: z
    .object({ possui: z.boolean(), inicio: z.string(), fim: z.string() })
    .superRefine((f, ctx) => {
      const msg = validarIntervalo(f);
      if (msg) ctx.addIssue({ code: "custom", message: msg, path: ["inicio"] });
    }),
});
type Dados = z.infer<typeof esquema>;

export type TextosApresentacao = {
  descricao: string | null;
  whatsapp: string | null;
  instagram: string | null;
  endereco: string | null;
  horarios: Horarios | null;
  intervalo: Intervalo | null;
};

type DadosSalvar = {
  descricao: string;
  whatsapp: string;
  instagram: string;
  endereco: string;
  horarios: Horarios | null;
  intervalo: Intervalo | null;
};

/** Traduz os erros do react-hook-form do bloco de horário para o formato do editor. */
function errosDoHorario(e: unknown): ErrosHorarioForm | undefined {
  const h = e as
    { padrao?: { message?: string }; extras?: ({ message?: string } | undefined)[] } | undefined;
  if (!h) return undefined;
  const extras: Record<number, string> = {};
  h.extras?.forEach((x, i) => {
    if (x?.message) extras[i] = x.message;
  });
  return { ...(h.padrao?.message ? { padrao: h.padrao.message } : {}), extras };
}

const valoresIniciais = (e: TextosApresentacao): Dados => ({
  descricao: e.descricao ?? "",
  whatsapp: e.whatsapp ?? "",
  instagram: e.instagram ?? "",
  endereco: e.endereco ?? "",
  horario: horariosParaForm(e.horarios),
  intervalo: intervaloParaForm(e.intervalo),
});

/**
 * Formulário da página de apresentação (textos, contatos, endereço, horário e intervalo). Serve à página
 * de uma empresa (editado pelo admin) e à da INOV4 (editado pelo master): quem usa informa como salvar.
 */
export function FormApresentacao({
  inicial,
  salvar: salvarDados,
  aposSalvar,
  linkDaPagina,
}: {
  inicial: TextosApresentacao;
  salvar: (d: DadosSalvar) => Promise<void>;
  aposSalvar: () => Promise<unknown>;
  linkDaPagina: string;
}) {
  const [erroGeral, setErroGeral] = useState<string>();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitted },
  } = useForm<Dados>({ resolver: zodResolver(esquema), defaultValues: valoresIniciais(inicial) });

  useEffect(() => reset(valoresIniciais(inicial)), [inicial, reset]);

  const mutacao = useMutation({
    mutationFn: (d: Dados) =>
      salvarDados({
        descricao: d.descricao,
        whatsapp: normalizarWhatsapp(d.whatsapp),
        instagram: normalizarInstagram(d.instagram),
        endereco: d.endereco,
        horarios: formParaHorarios(d.horario),
        intervalo: formParaIntervalo(d.intervalo),
      }),
    onSuccess: async () => {
      await aposSalvar();
      toast.success("Página atualizada.");
    },
    onError: (e) =>
      setErroGeral(e instanceof ErroEmpresa ? e.message : MENSAGENS_EMPRESA.desconhecido),
  });

  const possuiIntervalo = watch("intervalo.possui");
  const salvar = handleSubmit((d) => {
    setErroGeral(undefined);
    mutacao.mutate(d);
  });

  return (
    <form onSubmit={salvar} noValidate className="space-y-4">
      <Campo
        id="apr-descricao"
        rotulo="Apresentação"
        erro={errors.descricao?.message}
        dica={`Até ${LIMITE_DESCRICAO} caracteres. Aparece logo abaixo do nome. Pode usar emoji.`}
      >
        <Textarea
          id="apr-descricao"
          rows={3}
          maxLength={LIMITE_DESCRICAO}
          placeholder="🎱 Sinuca · 💨 Narguile · 🍻 Bebidas"
          {...register("descricao")}
        />
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          id="apr-whatsapp"
          rotulo="WhatsApp"
          erro={errors.whatsapp?.message}
          dica="Com DDD. O cliente toca e abre a conversa."
        >
          <Input
            id="apr-whatsapp"
            inputMode="tel"
            placeholder="(51) 93500-1383"
            {...register("whatsapp")}
          />
        </Campo>
        <Campo
          id="apr-instagram"
          rotulo="Instagram"
          erro={errors.instagram?.message}
          dica="Só o usuário. O cliente toca e abre o perfil."
        >
          <Input
            id="apr-instagram"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="@nevoa.lounge"
            {...register("instagram")}
          />
        </Campo>
      </div>
      <Campo
        id="apr-endereco"
        rotulo="Endereço"
        erro={errors.endereco?.message}
        dica="Pode usar duas linhas (ex.: rua e número / cidade e CEP). O cliente toca e abre o mapa."
      >
        <Textarea
          id="apr-endereco"
          rows={2}
          maxLength={LIMITE_ENDERECO}
          {...register("endereco")}
        />
      </Campo>

      <HorarioEditor
        valor={watch("horario")}
        erros={errosDoHorario(errors.horario)}
        onChange={(v) => setValue("horario", v, { shouldDirty: true, shouldValidate: isSubmitted })}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Intervalo</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" {...register("intervalo.possui")} />
          Possui intervalo (vale para todos os dias abertos)
        </label>
        {possuiIntervalo ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="time"
              aria-label="Intervalo: início"
              className="w-28"
              {...register("intervalo.inicio")}
            />
            <span className="text-sm text-muted-foreground">às</span>
            <Input
              type="time"
              aria-label="Intervalo: fim"
              className="w-28"
              {...register("intervalo.fim")}
            />
          </div>
        ) : null}
        {errors.intervalo?.inicio?.message ? (
          <p className="text-xs text-destructive">{errors.intervalo.inicio.message}</p>
        ) : null}
      </fieldset>

      {erroGeral && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {erroGeral}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={mutacao.isPending || !isDirty}>
          {mutacao.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Salvar
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href={linkDaPagina} target="_blank" rel="noreferrer noopener">
            <ExternalLink aria-hidden /> Ver a página
          </a>
        </Button>
      </div>
    </form>
  );
}
