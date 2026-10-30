import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, KeyRound, Plus, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Carregando, EmptyState, PageHeader, Painel, Selo } from "@/components/app/common";
import { FormNovoAdministrador } from "@/components/administradores/FormNovoAdministrador";
import { RedefinirSenhaDialog } from "@/components/administradores/RedefinirSenhaDialog";
import { VinculosDialog } from "@/components/administradores/VinculosDialog";
import {
  CHAVE_ADMINISTRADORES,
  ErroAdmin,
  listarAdministradores,
} from "@/lib/administradores/servico";
import { MENSAGENS_ADMIN, type AdministradorListado } from "@/lib/administradores/tipos";
import { useSessao } from "@/lib/auth/use-sessao";
import { useEmpresaAtual } from "@/lib/empresa/atual";

export const Route = createFileRoute("/master/administradores")({
  head: () => ({
    meta: [{ title: "Administradores — Mesa Digital" }, { name: "robots", content: "noindex" }],
  }),
  component: Administradores,
});

function Administradores() {
  const { sessao } = useSessao();
  if (!sessao) return <Carregando />;
  return <Lista usuarioId={sessao.usuarioId} />;
}

const dataCurta = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "nunca";

function Lista({ usuarioId }: { usuarioId: string }) {
  const empresasCtx = useEmpresaAtual(usuarioId, "master");
  const consulta = useQuery({
    queryKey: CHAVE_ADMINISTRADORES,
    queryFn: listarAdministradores,
    retry: false,
  });
  const [novoAberto, setNovoAberto] = useState(false);
  const [vinculando, setVinculando] = useState<AdministradorListado | null>(null);
  const [redefinindo, setRedefinindo] = useState<AdministradorListado | null>(null);

  const mensagemErro =
    consulta.error instanceof ErroAdmin
      ? consulta.error.message
      : consulta.isError
        ? MENSAGENS_ADMIN.desconhecido
        : "";

  return (
    <>
      <PageHeader
        titulo="Administradores"
        descricao="Pessoas que gerenciam as empresas. Crie o acesso, escolha as empresas e gere uma nova senha provisória quando precisar."
        acoes={
          <Button onClick={() => setNovoAberto(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Novo administrador
          </Button>
        }
      />
      <Painel>
        {consulta.isPending ? (
          <Carregando />
        ) : consulta.isError ? (
          <EmptyState
            icone={Users}
            titulo="Não foi possível carregar os administradores"
            texto={mensagemErro}
            acao={<Button onClick={() => void consulta.refetch()}>Tentar novamente</Button>}
          />
        ) : consulta.data.length === 0 ? (
          <EmptyState
            icone={UserCog}
            titulo="Nenhum administrador cadastrado"
            texto="Crie o primeiro para que alguém possa gerenciar uma empresa."
            acao={<Button onClick={() => setNovoAberto(true)}>Novo administrador</Button>}
          />
        ) : (
          <ul className="divide-y">
            {consulta.data.map((a) => (
              <li
                key={a.usuarioId}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-center"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-all font-medium">{a.email}</p>
                    <Selo tom={a.deveTrocarSenha ? "alerta" : "sucesso"}>
                      {a.deveTrocarSenha ? "Primeiro acesso pendente" : "Ativo"}
                    </Selo>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {a.empresas.length === 0 ? (
                      <Selo tom="neutro">Sem empresa vinculada</Selo>
                    ) : (
                      a.empresas.map((e) => (
                        <Selo key={e.id} tom="destaque">
                          {e.nome}
                        </Selo>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Último acesso: {dataCurta(a.ultimoAcesso)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setVinculando(a)}>
                    <Building2 className="h-4 w-4" aria-hidden /> Empresas
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRedefinindo(a)}>
                    <KeyRound className="h-4 w-4" aria-hidden /> Nova senha provisória
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Painel>
      <FormNovoAdministrador
        aberto={novoAberto}
        onFechar={() => setNovoAberto(false)}
        empresas={empresasCtx.empresas}
      />
      <VinculosDialog
        administrador={vinculando}
        onFechar={() => setVinculando(null)}
        empresas={empresasCtx.empresas}
      />
      <RedefinirSenhaDialog administrador={redefinindo} onFechar={() => setRedefinindo(null)} />
    </>
  );
}
