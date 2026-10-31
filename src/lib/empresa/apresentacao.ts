// Textos da página de apresentação da empresa (/{slug}). Os limites espelham docs/sql/11 e 12.
export const LIMITE_DESCRICAO = 500;
export const LIMITE_ENDERECO = 200;

/** Link para abrir o endereço no mapa (busca por texto, sem chave de API). */
export const urlDoMapa = (endereco: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco.replace(/\s*\n\s*/g, ", "))}`;

export const COR_HEX = /^#[0-9a-fA-F]{6}$/;
