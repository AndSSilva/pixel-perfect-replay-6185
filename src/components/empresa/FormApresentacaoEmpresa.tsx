import { useQueryClient } from "@tanstack/react-query";
import { FormApresentacao } from "@/components/empresa/FormApresentacao";
import { CHAVE_EMPRESAS } from "@/lib/empresa/atual";
import type { Horarios, Intervalo } from "@/lib/empresa/horarios";
import { chaveApresentacao } from "@/lib/empresa/publico";
import { atualizarApresentacao } from "@/lib/empresa/servico";
import type { Empresa } from "@/lib/empresa/tipos";

/** Página `/{empresa}`: o administrador da empresa edita em Configurações. */
export function FormApresentacaoEmpresa({ empresa }: { empresa: Empresa }) {
  const qc = useQueryClient();
  return (
    <FormApresentacao
      inicial={{
        descricao: empresa.descricao,
        whatsapp: empresa.whatsapp,
        instagram: empresa.instagram,
        endereco: empresa.endereco,
        horarios: empresa.horarios as Horarios | null,
        intervalo: empresa.intervalo as Intervalo | null,
      }}
      salvar={(d) => atualizarApresentacao(empresa.id, d)}
      aposSalvar={async () => {
        await qc.invalidateQueries({ queryKey: CHAVE_EMPRESAS });
        await qc.invalidateQueries({ queryKey: chaveApresentacao(empresa.slug) });
      }}
      linkDaPagina={`/${empresa.slug}`}
    />
  );
}
