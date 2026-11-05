import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PaginaApresentacao } from "@/components/empresa/PaginaApresentacao";
import { INOV4, chavePlataforma, obterPlataforma } from "@/lib/empresa/plataforma";
import { corDoTextoSobre } from "@/lib/pedidos/rotulos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Comanda Fácil" },
      {
        name: "description",
        content:
          "INOV4 HUB — cardápio digital por mesa, pedidos e contas para bares e restaurantes.",
      },
    ],
  }),
  component: Inicio,
});

/** Link principal (sem o nome de uma empresa): a página da INOV4 com o botão "Acessar" para o painel. */
function Inicio() {
  // Se os textos não carregarem (ex.: script 14 ainda não rodou), a página abre só com logo, nome e "Acessar".
  const consulta = useQuery({ queryKey: chavePlataforma, queryFn: obterPlataforma });
  const t = consulta.data;
  return (
    <PaginaApresentacao
      dados={{
        nome: INOV4.nome,
        logoUrl: INOV4.logo,
        descricao: t?.descricao ?? null,
        whatsapp: t?.whatsapp ?? null,
        instagram: t?.instagram ?? null,
        endereco: t?.endereco ?? null,
        horarios: t?.horarios ?? null,
        intervalo: t?.intervalo ?? null,
      }}
      fundo={INOV4.fundo}
      primaria={INOV4.primaria}
      logoAlt="Logo INOV4 HUB"
      acao={
        <Button
          asChild
          className="h-12 w-full rounded-full text-base font-semibold"
          style={{ backgroundColor: INOV4.primaria, color: corDoTextoSobre(INOV4.primaria) }}
        >
          <Link to="/admin/login">Acessar</Link>
        </Button>
      }
    />
  );
}
