import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Armchair, TriangleAlert, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Carregando, EmptyState } from "@/components/app/common";
import { PaginaApresentacao } from "@/components/empresa/PaginaApresentacao";
import type { Horarios, Intervalo } from "@/lib/empresa/horarios";
import { chaveApresentacao, obterApresentacao } from "@/lib/empresa/publico";
import { corDoTextoSobre, corSegura } from "@/lib/pedidos/rotulos";

export const Route = createFileRoute("/$slug/")({
  head: () => ({
    meta: [
      { title: "Cardápio por mesa" },
      {
        name: "description",
        content: "Conheça o lugar, veja o horário e escolha uma mesa para pedir.",
      },
    ],
  }),
  component: Apresentacao,
});

function Apresentacao() {
  const { slug } = Route.useParams();
  const slugMinusculo = slug.toLowerCase();
  const consulta = useQuery({
    queryKey: chaveApresentacao(slugMinusculo),
    queryFn: () => obterApresentacao(slugMinusculo),
    refetchInterval: 20_000,
  });
  const [mesasAbertas, setMesasAbertas] = useState(false);

  if (consulta.isPending) return <Carregando />;
  if (consulta.isError) {
    return (
      <div className="mx-auto max-w-md p-6">
        <EmptyState
          icone={TriangleAlert}
          titulo="Não foi possível carregar"
          texto="Verifique sua conexão e tente novamente."
          acao={<Button onClick={() => void consulta.refetch()}>Tentar novamente</Button>}
        />
      </div>
    );
  }
  const dados = consulta.data;
  if (!dados) {
    return (
      <div className="mx-auto max-w-md p-6">
        <EmptyState
          icone={UtensilsCrossed}
          titulo="Estabelecimento não encontrado"
          texto="Confira o endereço ou o QR Code."
        />
      </div>
    );
  }

  const { empresa, mesas } = dados;
  const primaria = corSegura(empresa.cor_primaria, "#2563EB");
  const fundo = corSegura(empresa.cor_secundaria, "#0F172A");
  const textoBotao = corDoTextoSobre(primaria);
  const livres = mesas.filter((m) => m.disponivel);

  return (
    <>
      <PaginaApresentacao
        dados={{
          nome: empresa.nome,
          logoUrl: empresa.logo_url,
          descricao: empresa.descricao,
          whatsapp: empresa.whatsapp,
          instagram: empresa.instagram,
          endereco: empresa.endereco,
          horarios: empresa.horarios as Horarios | null,
          intervalo: empresa.intervalo as Intervalo | null,
        }}
        fundo={fundo}
        primaria={primaria}
        creditoInov4
        acao={
          <Button
            className="h-12 w-full rounded-full text-base font-semibold"
            style={{ backgroundColor: primaria, color: textoBotao }}
            onClick={() => {
              void consulta.refetch();
              setMesasAbertas(true);
            }}
          >
            Ver mesas
          </Button>
        }
      />
      <Sheet open={mesasAbertas} onOpenChange={setMesasAbertas}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[85vh] max-w-md overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Armchair className="h-5 w-5" aria-hidden /> Mesas disponíveis
            </SheetTitle>
            <SheetDescription>
              {livres.length > 0
                ? "Toque no número da mesa onde você está para ver o cardápio e pedir."
                : mesas.length === 0
                  ? "O cardápio por mesa ainda não está disponível."
                  : "No momento todas as mesas estão ocupadas. Fale com o atendente."}
            </SheetDescription>
          </SheetHeader>
          {livres.length > 0 ? (
            <ul className="mt-4 grid grid-cols-3 gap-3 pb-4">
              {livres.map((m) => (
                <li key={m.numero}>
                  <Button
                    asChild
                    className="h-16 w-full flex-col gap-0 text-base"
                    style={{ backgroundColor: primaria, color: textoBotao }}
                  >
                    <Link
                      to="/$slug/$mesa"
                      params={{ slug: empresa.slug, mesa: `mesa_${m.numero}` }}
                    >
                      <span className="text-xs opacity-80">Mesa</span>
                      <span className="text-xl font-semibold">{m.numero}</span>
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
