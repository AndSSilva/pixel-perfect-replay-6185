import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
import { Campo } from "@/components/app/common";
import { CHAVE_EMPRESAS } from "@/lib/empresa/atual";
import { atualizarEmpresa, criarEmpresa } from "@/lib/empresa/servico";
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
});
type Dados = z.infer<typeof esquema>;

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
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: { nome: empresa?.nome ?? "", slug: empresa?.slug ?? "" },
  });

  // Reabre limpo (ou com os dados da empresa em edição).
  useEffect(() => {
    if (aberto) {
      reset({ nome: empresa?.nome ?? "", slug: empresa?.slug ?? "" });
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
    mutationFn: (d: Dados) =>
      empresa ? atualizarEmpresa(empresa.id, { nome: d.nome }) : criarEmpresa(d),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: CHAVE_EMPRESAS });
      toast.success(edicao ? "Empresa atualizada." : "Empresa criada.");
      onFechar();
    },
    onError: (e) =>
      setErroGeral(e instanceof ErroEmpresa ? e.message : MENSAGENS_EMPRESA.desconhecido),
  });

  const salvar = handleSubmit((d) => {
    setErroGeral(undefined);
    mutacao.mutate(d);
  });

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !mutacao.isPending && onFechar()}>
      <DialogContent>
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
