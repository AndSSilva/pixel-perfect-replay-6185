// Endereço (slug) do catálogo da empresa: /nome_da_empresa. Regras espelham as do banco
// (constraints estabelecimentos_slug_formato e estabelecimentos_slug_reservado).
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

/** Nomes que colidem com rotas e arquivos do app. Mantenha igual ao script SQL. */
export const SLUGS_RESERVADOS: readonly string[] = [
  "admin",
  "master",
  "cardapio",
  "api",
  "login",
  "logout",
  "entrar",
  "sair",
  "brand",
  "assets",
  "static",
  "public",
  "app",
  "www",
  "health",
  "status",
  "suporte",
  "ajuda",
  "termos",
  "privacidade",
  "inov4",
  "inov4hub",
  "mesa",
  "mesas",
];

export const REGEX_SLUG = /^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$/;

/** Sugere um slug a partir do nome: sem acentos, minúsculas, separado por "_". */
export function sugerirSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/_+$/g, "");
}

/** Mensagem de erro (em português) ou null se o slug é válido. */
export function validarSlug(slug: string): string | null {
  if (slug.length < SLUG_MIN) return `Use pelo menos ${SLUG_MIN} caracteres.`;
  if (slug.length > SLUG_MAX) return `Use no máximo ${SLUG_MAX} caracteres.`;
  if (!REGEX_SLUG.test(slug)) {
    return "Use só letras minúsculas, números, hífen e sublinhado, começando e terminando com letra ou número.";
  }
  if (SLUGS_RESERVADOS.includes(slug)) return "Este endereço é reservado. Escolha outro.";
  return null;
}
