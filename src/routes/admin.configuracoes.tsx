import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Painel, Selo } from "@/components/app/common";
import { FormApresentacaoEmpresa } from "@/components/empresa/FormApresentacaoEmpresa";
import { useEmpresa } from "@/lib/empresa/contexto";
import { corSegura } from "@/lib/pedidos/rotulos";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Comanda Fácil - Administrador" },
      { name: "description", content: "Dados do estabelecimento." },
    ],
  }),
  component: Configuracoes,
});

function Configuracoes() {
  const empresa = useEmpresa();
  const primaria = corSegura(empresa.cor_primaria, "#2563EB");
  const secundaria = corSegura(empresa.cor_secundaria, "#0F172A");
  const endereco = `${window.location.origin}/${empresa.slug}`;
  return (
    <>
      <PageHeader
        titulo="Configurações"
        descricao="Página da sua empresa e dados do estabelecimento. Para alterar nome, endereço do cardápio, logo ou cores, fale com o administrador da plataforma."
      />
      <div className="max-w-2xl space-y-6">
        <Painel titulo="Página da empresa">
          <p className="mb-4 text-sm text-muted-foreground">
            É o que o cliente vê ao abrir {endereco}, antes de escolher a mesa.
          </p>
          <FormApresentacaoEmpresa empresa={empresa} />
        </Painel>
        <Painel titulo="Estabelecimento">
          <dl className="space-y-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Nome</dt>
              <dd className="font-medium">{empresa.nome}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Endereço do cardápio</dt>
              <dd className="break-all font-medium">{endereco}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Situação</dt>
              <dd>
                <Selo tom={empresa.ativo ? "sucesso" : "neutro"}>
                  {empresa.ativo ? "Ativa" : "Desativada"}
                </Selo>
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-muted-foreground">Cores do cardápio</dt>
              <dd className="flex items-center gap-2">
                {[primaria, secundaria].map((c) => (
                  <span key={c} className="flex items-center gap-1 text-xs">
                    <span
                      className="h-5 w-5 rounded border"
                      style={{ backgroundColor: c }}
                      aria-hidden
                    />
                    {c}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            O endereço do cardápio de cada mesa é {endereco}/mesa_<em>número</em> (use o QR Code em
            Mesas).
          </p>
        </Painel>
      </div>
    </>
  );
}
