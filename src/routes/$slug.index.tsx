import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Armchair,
  ChevronRight,
  Clock,
  Instagram,
  MapPin,
  MessageCircle,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Carregando, EmptyState } from "@/components/app/common";
import { urlDoMapa } from "@/lib/empresa/apresentacao";
import {
  agoraNoFuso,
  agruparDias,
  formatarWhatsapp,
  horariosValidos,
  linkInstagram,
  linkWhatsapp,
  statusAgora,
  textoDaJanela,
  textoDoStatus,
} from "@/lib/empresa/horarios";
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
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
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
  const texto = corDoTextoSobre(fundo);
  const textoBotao = corDoTextoSobre(primaria);
  const cartao: CSSProperties = {
    backgroundColor: `color-mix(in srgb, ${texto} 7%, transparent)`,
    borderColor: `color-mix(in srgb, ${texto} 14%, transparent)`,
  };
  const suave: CSSProperties = { color: `color-mix(in srgb, ${texto} 68%, transparent)` };

  const horarios = horariosValidos(empresa.horarios) ? empresa.horarios : null;
  const status = horarios ? statusAgora(horarios, agora) : null;
  const diaHoje = agoraNoFuso(agora).dia;
  const livres = mesas.filter((m) => m.disponivel);
  const enderecoLinhas = (empresa.endereco ?? "").split("\n").filter((l) => l.trim() !== "");

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: fundo, color: texto }}>
      <main className="mx-auto max-w-md space-y-4 px-4 pt-10">
        <header className="text-center">
          {empresa.logo_url ? (
            <img
              src={empresa.logo_url}
              alt={`Logo ${empresa.nome}`}
              className="mx-auto h-28 w-28 rounded-3xl border object-contain p-1"
              style={cartao}
            />
          ) : null}
          <h1 className="mt-5 text-3xl font-bold tracking-tight">{empresa.nome}</h1>
          {empresa.descricao ? (
            <p className="mt-2 whitespace-pre-line text-balance" style={suave}>
              {empresa.descricao}
            </p>
          ) : null}
          {status ? (
            <p
              className="mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium"
              style={cartao}
              role="status"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: status.aberto ? "#4ade80" : "#f87171" }}
                aria-hidden
              />
              {textoDoStatus(status)}
            </p>
          ) : null}
        </header>

        {empresa.whatsapp || empresa.instagram ? (
          <div
            className={`grid gap-3 ${empresa.whatsapp && empresa.instagram ? "grid-cols-2" : "grid-cols-1"}`}
          >
            {empresa.whatsapp ? (
              <ContatoCard
                href={linkWhatsapp(empresa.whatsapp)}
                icone={<MessageCircle className="h-5 w-5" aria-hidden />}
                titulo="WhatsApp"
                detalhe={formatarWhatsapp(empresa.whatsapp)}
                estilo={cartao}
                suave={suave}
              />
            ) : null}
            {empresa.instagram ? (
              <ContatoCard
                href={linkInstagram(empresa.instagram)}
                icone={<Instagram className="h-5 w-5" aria-hidden />}
                titulo="Instagram"
                detalhe={`@${empresa.instagram}`}
                estilo={cartao}
                suave={suave}
              />
            ) : null}
          </div>
        ) : null}

        {horarios ? (
          <section className="rounded-2xl border p-4" style={cartao}>
            <h2 className="flex items-center gap-2 font-semibold">
              <Clock className="h-4 w-4" aria-hidden /> Horário de atendimento
            </h2>
            <ul className="mt-3 divide-y text-sm" style={{ borderColor: cartao.borderColor }}>
              {agruparDias(horarios).map((g) => (
                <li
                  key={g.rotulo}
                  className="flex items-center justify-between gap-3 py-2.5"
                  style={{ borderColor: cartao.borderColor }}
                >
                  <span className="flex items-center gap-2" style={g.janela ? undefined : suave}>
                    {g.rotulo}
                    {g.dias.includes(diaHoje) ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ backgroundColor: primaria, color: textoBotao }}
                      >
                        Hoje
                      </span>
                    ) : null}
                  </span>
                  <span
                    className="whitespace-nowrap tabular-nums"
                    style={g.janela ? undefined : suave}
                  >
                    {textoDaJanela(g.janela)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {enderecoLinhas.length > 0 && empresa.endereco ? (
          <a
            href={urlDoMapa(empresa.endereco)}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-3 rounded-2xl border p-4"
            style={cartao}
          >
            <MapPin className="h-6 w-6 shrink-0" style={{ color: primaria }} aria-hidden />
            <span className="min-w-0 flex-1 text-sm">
              <span className="block" style={suave}>
                Localização
              </span>
              {enderecoLinhas.map((l, i) => (
                <span key={l} className={`block ${i === 0 ? "font-semibold" : ""}`}>
                  {l}
                </span>
              ))}
              <span className="mt-1 block font-semibold" style={{ color: primaria }}>
                Abrir no mapa
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0" style={suave} aria-hidden />
          </a>
        ) : null}

        <p className="pt-2 text-center text-xs" style={suave}>
          Cardápio digital por <strong style={{ color: texto }}>INOV4 HUB</strong>
        </p>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 border-t px-4 py-4"
        style={{ backgroundColor: fundo, borderColor: cartao.borderColor }}
      >
        <div className="mx-auto max-w-md">
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
        </div>
      </div>

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
    </div>
  );
}

function ContatoCard({
  href,
  icone,
  titulo,
  detalhe,
  estilo,
  suave,
}: {
  href: string;
  icone: ReactNode;
  titulo: string;
  detalhe: string;
  estilo: CSSProperties;
  suave: CSSProperties;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="flex min-w-0 items-center gap-3 rounded-2xl border p-3"
      style={estilo}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
        style={estilo}
      >
        {icone}
      </span>
      <span className="min-w-0 text-sm">
        <span className="block font-semibold">{titulo}</span>
        <span className="block truncate text-xs" style={suave}>
          {detalhe}
        </span>
      </span>
    </a>
  );
}
