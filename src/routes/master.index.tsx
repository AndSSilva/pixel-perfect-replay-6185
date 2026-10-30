import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ExternalLink, LogIn, Pencil, Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Carregando,
  Confirmar,
  EmptyState,
  PageHeader,
  Painel,
  Selo,
} from "@/components/app/common";
import { FormEmpresa } from "@/components/empresa/FormEmpresa";
import { useSessao } from "@/lib/auth/use-sessao";
import { CHAVE_EMPRESAS, useEmpresaAtual } from "@/lib/empresa/atual";
import { atualizarEmpresa } from "@/lib/empresa/servico";
import { ErroEmpresa, MENSAGENS_EMPRESA, type Empresa } from "@/lib/empresa/tipos";

export const Route = createFileRoute("/master/")({
  component: CadastroEmpresas,
});

function CadastroEmpresas() {
  const { sessao } = useSessao();
  // O layout /master só renderiza depois da sessão de master; aqui ela já existe.
  if (!sessao) return <Carregando />;
  return <Lista usuarioId={sessao.usuarioId} />;
}

function Lista({ usuarioId }: { usuarioId: string }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const ctx = useEmpresaAtual(usuarioId, "master");
  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Empresa | undefined>();

  const alternarAtivo = useMutation({
    mutationFn: (e: Empresa) => atualizarEmpresa(e.id, { ativo: !e.ativo }),
    onSuccess: async (e) => {
      await qc.invalidateQueries({ queryKey: CHAVE_EMPRESAS });
      toast.success(e.ativo ? "Empresa ativada." : "Empresa desativada.");
    },
    onError: (e) =>
      toast.error(e instanceof ErroEmpresa ? e.message : MENSAGENS_EMPRESA.desconhecido),
  });

  const abrirNova = () => {
    setEmEdicao(undefined);
    setFormAberto(true);
  };

  return (
    <>
      <PageHeader
        titulo="Empresas"
        descricao="Cadastro das empresas clientes. Use “Entrar” para abrir o painel de uma empresa."
        acoes={
          <Button onClick={abrirNova}>
            <Plus className="h-4 w-4" aria-hidden /> Nova empresa
          </Button>
        }
      />
      <Painel>
        {ctx.carregando ? (
          <Carregando />
        ) : ctx.erro ? (
          <EmptyState
            icone={Building2}
            titulo="Não foi possível carregar as empresas"
            texto="Verifique sua conexão e tente novamente."
            acao={<Button onClick={() => void ctx.recarregar()}>Tentar novamente</Button>}
          />
        ) : ctx.empresas.length === 0 ? (
          <EmptyState
            icone={Building2}
            titulo="Nenhuma empresa cadastrada"
            texto="Crie a primeira empresa para começar."
            acao={<Button onClick={abrirNova}>Nova empresa</Button>}
          />
        ) : (
          <ul className="divide-y">
            {ctx.empresas.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{e.nome}</p>
                    <Selo tom={e.ativo ? "sucesso" : "neutro"}>
                      {e.ativo ? "Ativa" : "Inativa"}
                    </Selo>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
                    /{e.slug}
                    {e.ativo && (
                      <a
                        href={`/${e.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Abrir o catálogo de ${e.nome}`}
                        className="inline-flex text-link hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      ctx.escolher(e.id);
                      nav({ to: "/admin" });
                    }}
                  >
                    <LogIn className="h-4 w-4" aria-hidden /> Entrar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEmEdicao(e);
                      setFormAberto(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden /> Editar
                  </Button>
                  <Confirmar
                    gatilho={
                      <Button size="sm" variant="ghost" disabled={alternarAtivo.isPending}>
                        <Power className="h-4 w-4" aria-hidden /> {e.ativo ? "Desativar" : "Ativar"}
                      </Button>
                    }
                    titulo={e.ativo ? `Desativar ${e.nome}?` : `Ativar ${e.nome}?`}
                    descricao={
                      e.ativo
                        ? "Os administradores desta empresa perdem o acesso e o catálogo para os clientes sai do ar. Nenhum dado é apagado e você pode reativar depois."
                        : "A empresa volta a funcionar: administradores acessam o painel e o catálogo volta ao ar."
                    }
                    rotuloAcao={e.ativo ? "Desativar" : "Ativar"}
                    perigo={e.ativo}
                    onConfirmar={() => alternarAtivo.mutate(e)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Painel>
      <FormEmpresa aberto={formAberto} onFechar={() => setFormAberto(false)} empresa={emEdicao} />
    </>
  );
}
