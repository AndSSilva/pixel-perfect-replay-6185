import { createFileRoute } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Carregando, EmptyState, PageHeader, Painel } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { FormApresentacao } from "@/components/empresa/FormApresentacao";
import { atualizarPlataforma, chavePlataforma, obterPlataforma } from "@/lib/empresa/plataforma";

export const Route = createFileRoute("/master/configuracoes")({
  head: () => ({
    meta: [
      { title: "Comanda Fácil - Master" },
      { name: "description", content: "Página da INOV4 (link principal)." },
    ],
  }),
  component: ConfiguracoesPlataforma,
});

function ConfiguracoesPlataforma() {
  const qc = useQueryClient();
  const consulta = useQuery({ queryKey: chavePlataforma, queryFn: obterPlataforma });
  return (
    <>
      <PageHeader
        titulo="Configurações"
        descricao="Página da INOV4, exibida no link principal (sem o nome de uma empresa). Logo, nome e cores seguem o padrão da INOV4."
      />
      <div className="max-w-2xl space-y-6">
        <Painel titulo="Página da INOV4">
          {consulta.isPending ? (
            <Carregando />
          ) : consulta.isError ? (
            <EmptyState
              icone={TriangleAlert}
              titulo="Não foi possível carregar"
              texto="Confira se o script 14 foi executado no banco."
              acao={<Button onClick={() => void consulta.refetch()}>Tentar novamente</Button>}
            />
          ) : (
            <FormApresentacao
              inicial={consulta.data}
              salvar={atualizarPlataforma}
              aposSalvar={() => qc.invalidateQueries({ queryKey: chavePlataforma })}
              linkDaPagina="/"
            />
          )}
        </Painel>
      </div>
    </>
  );
}
