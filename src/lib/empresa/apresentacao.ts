// Textos da página de apresentação da empresa (/{slug}). Os limites espelham docs/sql/11_apresentacao_empresa.sql.
export const LIMITE_DESCRICAO = 500;
export const LIMITE_HORARIO = 300;
export const LIMITE_ENDERECO = 200;
export const MAX_DESTAQUES = 8;
export const LIMITE_DESTAQUE = 60;

/** Uma linha por destaque: ignora linhas vazias e espaços nas pontas. */
export const destaquesDoTexto = (texto: string): string[] =>
  texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");

export const textoDosDestaques = (d: readonly string[]): string => d.join("\n");

export function validarDestaques(lista: readonly string[]): string | null {
  if (lista.length > MAX_DESTAQUES) return `Use no máximo ${MAX_DESTAQUES} destaques.`;
  if (lista.some((d) => d.length > LIMITE_DESTAQUE))
    return `Cada destaque pode ter até ${LIMITE_DESTAQUE} caracteres.`;
  return null;
}

/** Link para abrir o endereço no mapa (busca por texto, sem chave de API). */
export const urlDoMapa = (endereco: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;

export const COR_HEX = /^#[0-9a-fA-F]{6}$/;
