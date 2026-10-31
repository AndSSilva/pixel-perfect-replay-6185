import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Armchair, Clock, MapPin, TriangleAlert, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Carregando, EmptyState } from "@/components/app/common";
import { urlDoMapa } from "@/lib/empresa/apresentacao";
import { chaveApresentacao, obterApresentacao } from "@/lib/empresa/publico";
import { corDoTextoSobre, corSegura } from "@/lib/pedidos/rotulos";

export const Route = createFileRoute("/$slug/")({
  head: () => ({
    meta: [
      { title: "Escolha sua mesa" },
      { name: "description", content: "Conheça o lugar e escolha uma mesa para fazer seu pedido." },
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
  const topo = corSegura(empresa.cor_secundaria, "#0F172A");
  const textoTopo = corDoTextoSobre(topo);
  const textoBotao = corDoTextoSobre(primaria);
  const livres = mesas.filter((m) => m.disponivel);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header
        className="px-4 pb-8 pt-10 text-center"
        style={{ backgroundColor: topo, color: textoTopo }}
      >
        <div className="mx-auto max-w-xl">
          {empresa.logo_url ? (
            <img
              src={empresa.logo_url}
              alt={`Logo ${empresa.nome}`}
              className="mx-auto h-32 w-32 rounded-full object-contain"
            />
          ) : null}
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{empresa.nome}</h1>
          {empresa.destaques.length > 0 ? (
            <ul className="mt-4 flex flex-wrap justify-center gap-2">
              {empresa.destaques.map((d) => (
                <li
                  key={d}
                  className="rounded-full border px-3 py-1 text-sm"
                  style={{ borderColor: `${textoTopo}55` }}
                >
                  {d}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-8 px-4 py-8">
        {empresa.descricao ? (
          <p className="whitespace-pre-line text-center text-muted-foreground">
            {empresa.descricao}
          </p>
        ) : null}

        {empresa.horario_funcionamento || empresa.endereco ? (
          <section className="space-y-4 rounded-xl border bg-card p-4 text-sm">
            {empresa.horario_funcionamento ? (
              <div className="flex gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <h2 className="font-medium">Horário de funcionamento</h2>
                  <p className="whitespace-pre-line text-muted-foreground">
                    {empresa.horario_funcionamento}
                  </p>
                </div>
              </div>
            ) : null}
            {empresa.endereco ? (
              <div className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <h2 className="font-medium">Endereço</h2>
                  <p className="text-muted-foreground">{empresa.endereco}</p>
                  <a
                    href={urlDoMapa(empresa.endereco)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 inline-block text-link underline"
                  >
                    Abrir no mapa
                  </a>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section aria-labelledby="escolha-mesa">
          <h2
            id="escolha-mesa"
            className="flex items-center justify-center gap-2 text-lg font-semibold"
          >
            <Armchair className="h-5 w-5" aria-hidden /> Escolha uma mesa disponível
          </h2>
          {livres.length === 0 ? (
            <p className="mt-4 rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">
              {mesas.length === 0
                ? "O cardápio por mesa ainda não está disponível."
                : "No momento todas as mesas estão ocupadas. Fale com o atendente."}
            </p>
          ) : (
            <>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                Toque no número da mesa onde você está para ver o cardápio e pedir.
              </p>
              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
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
            </>
          )}
        </section>
      </main>
    </div>
  );
}
