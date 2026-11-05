import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronRight, Clock, Instagram, MapPin, MessageCircle } from "lucide-react";
import { urlDoMapa } from "@/lib/empresa/apresentacao";
import {
  agoraNoFuso,
  agruparDias,
  formatarWhatsapp,
  horariosValidos,
  intervaloValido,
  linkInstagram,
  linkWhatsapp,
  statusAgora,
  textoDaJanela,
  textoDoIntervalo,
  textoDoStatus,
  type Horarios,
  type Intervalo,
} from "@/lib/empresa/horarios";
import { corDoTextoSobre } from "@/lib/pedidos/rotulos";
import { ThemeToggle } from "@/components/app/ThemeToggle";

/**
 * Fundo da página em cada tema. Se a cor da empresa já combina com o tema (clara no modo claro, escura
 * no escuro) ela é usada como está; senão vira uma variação suave da mesma cor (tom de 7% sobre branco e 14%
 * ou sobre grafite), mantendo a identidade sem estourar o contraste. A cor vem validada como #rrggbb.
 */
export function fundosPorTema(fundo: string): { claro: string; escuro: string } {
  const clara = corDoTextoSobre(fundo) === "#0f172a";
  return {
    claro: clara ? fundo : `color-mix(in srgb, ${fundo} 7%, #ffffff)`,
    escuro: clara ? `color-mix(in srgb, ${fundo} 14%, #0b1220)` : fundo,
  };
}

export type DadosPagina = {
  nome: string;
  logoUrl: string | null;
  descricao: string | null;
  whatsapp: string | null;
  instagram: string | null;
  endereco: string | null;
  horarios: Horarios | null;
  intervalo: Intervalo | null;
};

/**
 * Tela de apresentação (logo, nome, status, contatos, horário e localização) usada pela página de cada
 * empresa (`/{slug}`) e pela página da INOV4 (`/`). `acao` é o botão grande fixo no rodapé.
 */
export function PaginaApresentacao({
  dados,
  fundo,
  primaria,
  acao,
  creditoInov4 = false,
  logoAlt,
}: {
  dados: DadosPagina;
  fundo: string;
  primaria: string;
  acao: ReactNode;
  creditoInov4?: boolean;
  logoAlt?: string;
}) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const fundos = fundosPorTema(fundo);
  // As cores dependem do tema (classe "dark" no <html>, definida antes da pintura): ficam em variáveis CSS.
  const texto = "var(--pg-fg)";
  const textoBotao = corDoTextoSobre(primaria);
  const cartao: CSSProperties = {
    backgroundColor: `color-mix(in srgb, ${texto} 7%, transparent)`,
    borderColor: `color-mix(in srgb, ${texto} 14%, transparent)`,
  };
  const suave: CSSProperties = { color: `color-mix(in srgb, ${texto} 68%, transparent)` };

  const horarios = horariosValidos(dados.horarios) ? dados.horarios : null;
  const intervalo = intervaloValido(dados.intervalo) ? dados.intervalo : null;
  const status = horarios ? statusAgora(horarios, agora, undefined, intervalo) : null;
  const diaHoje = agoraNoFuso(agora).dia;
  const enderecoLinhas = (dados.endereco ?? "").split("\n").filter((l) => l.trim() !== "");

  return (
    <div
      className="pagina-apresentacao relative min-h-screen pb-32"
      style={{ backgroundColor: "var(--pg-bg)", color: texto }}
    >
      <style>{`.pagina-apresentacao{--pg-bg:${fundos.claro};--pg-fg:#0f172a}.dark .pagina-apresentacao{--pg-bg:${fundos.escuro};--pg-fg:#ffffff}`}</style>
      <ThemeToggle className="absolute right-4 top-4 border-transparent bg-transparent text-[color:var(--pg-fg)] shadow-none hover:bg-black/5 hover:text-[color:var(--pg-fg)] dark:hover:bg-white/10" />
      <main className="mx-auto max-w-md space-y-4 px-4 pt-10">
        <header className="text-center">
          {dados.logoUrl ? (
            <img
              src={dados.logoUrl}
              alt={logoAlt ?? `Logo ${dados.nome}`}
              className="mx-auto h-28 w-28 rounded-3xl border object-contain p-1"
              style={cartao}
            />
          ) : null}
          <h1 className="mt-5 text-3xl font-bold tracking-tight">{dados.nome}</h1>
          {dados.descricao ? (
            <p className="mt-2 whitespace-pre-line text-balance" style={suave}>
              {dados.descricao}
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
                style={{
                  backgroundColor: !status.aberto
                    ? "#f87171"
                    : status.intervaloAte
                      ? "#fbbf24"
                      : "#4ade80",
                }}
                aria-hidden
              />
              {textoDoStatus(status)}
            </p>
          ) : null}
        </header>

        {dados.whatsapp || dados.instagram ? (
          <div
            className={`grid gap-3 ${dados.whatsapp && dados.instagram ? "grid-cols-2" : "grid-cols-1"}`}
          >
            {dados.whatsapp ? (
              <ContatoCard
                href={linkWhatsapp(dados.whatsapp)}
                icone={<MessageCircle className="h-5 w-5" aria-hidden />}
                titulo="WhatsApp"
                detalhe={formatarWhatsapp(dados.whatsapp)}
                estilo={cartao}
                suave={suave}
              />
            ) : null}
            {dados.instagram ? (
              <ContatoCard
                href={linkInstagram(dados.instagram)}
                icone={<Instagram className="h-5 w-5" aria-hidden />}
                titulo="Instagram"
                detalhe={`@${dados.instagram}`}
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
            <p
              className="mt-2 border-t pt-2.5 text-sm"
              style={{ ...suave, borderColor: cartao.borderColor }}
            >
              {textoDoIntervalo(intervalo)}
            </p>
          </section>
        ) : null}

        {enderecoLinhas.length > 0 && dados.endereco ? (
          <a
            href={urlDoMapa(dados.endereco)}
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

        {creditoInov4 ? (
          <p className="pt-2 text-center text-xs" style={suave}>
            Cardápio digital por <strong style={{ color: texto }}>INOV4 HUB</strong>
          </p>
        ) : null}
      </main>

      <div
        className="fixed inset-x-0 bottom-0 border-t px-4 py-4"
        style={{ backgroundColor: "var(--pg-bg)", borderColor: cartao.borderColor }}
      >
        <div className="mx-auto max-w-md">{acao}</div>
      </div>
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
      className="flex min-w-0 items-center gap-2.5 rounded-2xl border p-2.5"
      style={estilo}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
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
