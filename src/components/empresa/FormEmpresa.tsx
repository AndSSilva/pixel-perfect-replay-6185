import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Campo } from "@/components/app/common";
import { CHAVE_EMPRESAS } from "@/lib/empresa/atual";
import { atualizarEmpresa, criarEmpresa } from "@/lib/empresa/servico";
import {
  COR_HEX,
  LIMITE_DESCRICAO,
  LIMITE_ENDERECO,
  LIMITE_HORARIO,
  destaquesDoTexto,
  textoDosDestaques,
  validarDestaques,
} from "@/lib/empresa/apresentacao";
import { apagarLogo, arquivoParaLogoPng, enviarLogo } from "@/lib/empresa/logo";
import { sugerirSlug, validarSlug } from "@/lib/empresa/slug";
import { ErroEmpresa, MENSAGENS_EMPRESA, type Empresa } from "@/lib/empresa/tipos";

const esquema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome da empresa.")
    .max(80, "Use no máximo 80 caracteres."),
  slug: z.string().superRefine((v, ctx) => {
    const erro = validarSlug(v);
    if (erro) ctx.addIssue({ code: "custom", message: erro });
  }),
  descricao: z.string().max(LIMITE_DESCRICAO, `Use no máximo ${LIMITE_DESCRICAO} caracteres.`),
  destaques: z.string().superRefine((v, ctx) => {
    const erro = validarDestaques(destaquesDoTexto(v));
    if (erro) ctx.addIssue({ code: "custom", message: erro });
  }),
  horario: z.string().max(LIMITE_HORARIO, `Use no máximo ${LIMITE_HORARIO} caracteres.`),
  endereco: z.string().max(LIMITE_ENDERECO, `Use no máximo ${LIMITE_ENDERECO} caracteres.`),
  corPrimaria: z.string().refine((v) => v === "" || COR_HEX.test(v), "Use o formato #RRGGBB."),
  corSecundaria: z.string().refine((v) => v === "" || COR_HEX.test(v), "Use o formato #RRGGBB."),
});
type Dados = z.infer<typeof esquema>;

const valoresIniciais = (e?: Empresa): Dados => ({
  nome: e?.nome ?? "",
  slug: e?.slug ?? "",
  descricao: e?.descricao ?? "",
  destaques: textoDosDestaques(e?.destaques ?? []),
  horario: e?.horario_funcionamento ?? "",
  endereco: e?.endereco ?? "",
  corPrimaria: e?.cor_primaria ?? "",
  corSecundaria: e?.cor_secundaria ?? "",
});

/** Cadastro e edição de empresa (só o master). O endereço (slug) não muda depois de criado. */
export function FormEmpresa({
  aberto,
  onFechar,
  empresa,
}: {
  aberto: boolean;
  onFechar: () => void;
  empresa?: Empresa | undefined;
}) {
  const edicao = !!empresa;
  const qc = useQueryClient();
  const [slugEditado, setSlugEditado] = useState(false);
  const [erroGeral, setErroGeral] = useState<string>();
  const [logoNovo, setLogoNovo] = useState<{ blob: Blob; previa: string } | null>(null);
  const [logoRemovido, setLogoRemovido] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciais(empresa),
  });

  // Reabre limpo (ou com os dados da empresa em edição).
  useEffect(() => {
    if (aberto) {
      reset(valoresIniciais(empresa));
      setLogoNovo(null);
      setLogoRemovido(false);
      setSlugEditado(false);
      setErroGeral(undefined);
    }
  }, [aberto, empresa, reset]);

  const slug = watch("slug");
  const registroNome = register("nome", {
    onChange: (e: { target: { value: string } }) => {
      if (!edicao && !slugEditado)
        setValue("slug", sugerirSlug(e.target.value), { shouldValidate: false });
    },
  });

  const mutacao = useMutation({
    mutationFn: async (d: Dados) => {
      if (!empresa) return criarEmpresa(d);
      let logoUrl: string | null | undefined;
      if (logoNovo) logoUrl = await enviarLogo(empresa.id, logoNovo.blob);
      else if (logoRemovido) logoUrl = null;
      try {
        const salva = await atualizarEmpresa(empresa.id, {
          nome: d.nome,
          descricao: d.descricao,
          destaques: destaquesDoTexto(d.destaques),
          horario_funcionamento: d.horario,
          endereco: d.endereco,
          cor_primaria: d.corPrimaria,
          cor_secundaria: d.corSecundaria,
          ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
        });
        if (logoUrl !== undefined) void apagarLogo(empresa.logo_url);
        return salva;
      } catch (e) {
        if (logoNovo && logoUrl) void apagarLogo(logoUrl); // não deixa arquivo órfão
        throw e;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: CHAVE_EMPRESAS });
      toast.success(edicao ? "Empresa atualizada." : "Empresa criada.");
      onFechar();
    },
    onError: (e) =>
      setErroGeral(e instanceof ErroEmpresa ? e.message : MENSAGENS_EMPRESA.desconhecido),
  });

  const escolherLogo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    try {
      const blob = await arquivoParaLogoPng(arquivo);
      setLogoNovo((antigo) => {
        if (antigo) URL.revokeObjectURL(antigo.previa);
        return { blob, previa: URL.createObjectURL(blob) };
      });
      setLogoRemovido(false);
      setErroGeral(undefined);
    } catch (e) {
      setErroGeral(e instanceof ErroEmpresa ? e.message : MENSAGENS_EMPRESA.logo_falhou);
    }
  };
  const logoAtual = logoNovo?.previa ?? (logoRemovido ? null : (empresa?.logo_url ?? null));

  const salvar = handleSubmit((d) => {
    setErroGeral(undefined);
    mutacao.mutate(d);
  });

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !mutacao.isPending && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={salvar} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{edicao ? "Editar empresa" : "Nova empresa"}</DialogTitle>
            <DialogDescription>
              {edicao
                ? "O endereço do catálogo não pode ser alterado depois de criado."
                : "O endereço do catálogo não poderá ser alterado depois de criado."}
            </DialogDescription>
          </DialogHeader>
          <Campo id="empresa-nome" rotulo="Nome da empresa" erro={errors.nome?.message}>
            <Input
              id="empresa-nome"
              autoFocus
              maxLength={80}
              aria-invalid={!!errors.nome}
              {...registroNome}
              name="nome"
            />
          </Campo>
          <Campo
            id="empresa-slug"
            rotulo="Endereço do catálogo"
            erro={errors.slug?.message}
            dica={
              slug
                ? `Catálogo em: ${typeof window === "undefined" ? "" : window.location.origin}/${slug}`
                : "Ex.: adega_ponto_gelado"
            }
          >
            <Input
              id="empresa-slug"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={40}
              disabled={edicao}
              aria-invalid={!!errors.slug}
              {...register("slug", {
                onChange: () => setSlugEditado(true),
                setValueAs: (v: string) => v.trim().toLowerCase(),
              })}
            />
          </Campo>
          {edicao && (
            <>
              <Campo
                id="empresa-logo"
                rotulo="Logo"
                dica="PNG, JPG ou WebP. Aparece na página de apresentação e no cardápio."
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
                    {logoAtual ? (
                      <img
                        src={logoAtual}
                        alt="Logo atual"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ImagePlus className="h-6 w-6 text-muted-foreground" aria-hidden />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <label className="cursor-pointer">
                        {logoAtual ? "Trocar logo" : "Enviar logo"}
                        <input
                          id="empresa-logo"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          onChange={(e) => {
                            void escolherLogo(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </Button>
                    {logoAtual && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLogoNovo(null);
                          setLogoRemovido(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden /> Remover
                      </Button>
                    )}
                  </div>
                </div>
              </Campo>
              <Campo
                id="empresa-descricao"
                rotulo="Apresentação"
                erro={errors.descricao?.message}
                dica={`Até ${LIMITE_DESCRICAO} caracteres. Texto curto sobre o lugar.`}
              >
                <Textarea
                  id="empresa-descricao"
                  rows={3}
                  maxLength={LIMITE_DESCRICAO}
                  {...register("descricao")}
                />
              </Campo>
              <Campo
                id="empresa-destaques"
                rotulo="Destaques"
                erro={errors.destaques?.message}
                dica="Um por linha, até 8. Pode usar emoji. Ex.: 🎱 Sinuca"
              >
                <Textarea id="empresa-destaques" rows={4} {...register("destaques")} />
              </Campo>
              <Campo
                id="empresa-horario"
                rotulo="Horário de funcionamento"
                erro={errors.horario?.message}
              >
                <Textarea
                  id="empresa-horario"
                  rows={2}
                  maxLength={LIMITE_HORARIO}
                  {...register("horario")}
                />
              </Campo>
              <Campo id="empresa-endereco" rotulo="Endereço" erro={errors.endereco?.message}>
                <Input
                  id="empresa-endereco"
                  maxLength={LIMITE_ENDERECO}
                  {...register("endereco")}
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo
                  id="empresa-cor1"
                  rotulo="Cor principal"
                  erro={errors.corPrimaria?.message}
                  dica="Botões e destaques"
                >
                  <div className="flex gap-2">
                    <input
                      type="color"
                      aria-label="Escolher cor principal"
                      className="h-9 w-10 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
                      value={COR_HEX.test(watch("corPrimaria")) ? watch("corPrimaria") : "#2563eb"}
                      onChange={(e) =>
                        setValue("corPrimaria", e.target.value, { shouldValidate: true })
                      }
                    />
                    <Input
                      id="empresa-cor1"
                      placeholder="#RRGGBB"
                      maxLength={7}
                      {...register("corPrimaria")}
                    />
                  </div>
                </Campo>
                <Campo
                  id="empresa-cor2"
                  rotulo="Cor do topo"
                  erro={errors.corSecundaria?.message}
                  dica="Fundo do cabeçalho"
                >
                  <div className="flex gap-2">
                    <input
                      type="color"
                      aria-label="Escolher cor do topo"
                      className="h-9 w-10 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
                      value={
                        COR_HEX.test(watch("corSecundaria")) ? watch("corSecundaria") : "#0f172a"
                      }
                      onChange={(e) =>
                        setValue("corSecundaria", e.target.value, { shouldValidate: true })
                      }
                    />
                    <Input
                      id="empresa-cor2"
                      placeholder="#RRGGBB"
                      maxLength={7}
                      {...register("corSecundaria")}
                    />
                  </div>
                </Campo>
              </div>
            </>
          )}
          {erroGeral && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {erroGeral}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar} disabled={mutacao.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutacao.isPending}>
              {mutacao.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {edicao ? "Salvar" : "Criar empresa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
