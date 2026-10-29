import { cn } from "@/lib/utils";

type Props = {
  variante?: "horizontal" | "vertical";
  className?: string;
  /** Largura em px da imagem. Respeite o mínimo do manual: logo horizontal ≥ 130px. */
  largura?: number;
};

const ARQUIVOS = {
  horizontal: {
    claro: "/brand/logo-horizontal-light.png",
    escuro: "/brand/logo-horizontal-dark.png",
    proporcao: 900 / 237,
  },
  vertical: {
    claro: "/brand/logo-vertical-light.png",
    escuro: "/brand/logo-vertical-dark.png",
    proporcao: 560 / 539,
  },
} as const;

/** Logo INOV4 HUB. Troca a versão (texto grafite ou branco) pela classe `dark` do <html>, sem JS. */
export function BrandLogo({ variante = "horizontal", className, largura = 180 }: Props) {
  const a = ARQUIVOS[variante];
  const altura = Math.round(largura / a.proporcao);
  const comum = { width: largura, height: altura, alt: "" } as const;
  return (
    <span className={cn("inline-flex", className)} role="img" aria-label="INOV4 HUB">
      <img src={a.claro} {...comum} className="block dark:hidden" />
      <img src={a.escuro} {...comum} className="hidden dark:block" />
    </span>
  );
}
