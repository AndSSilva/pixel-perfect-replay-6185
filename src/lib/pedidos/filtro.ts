import type { CardapioPublico } from "./tipos";

/** Minúsculas e sem acentos, para comparar "cafe" com "Café". */
export const normalizar = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Filtra o cardápio por categoria (opcional) e por trecho do nome do produto (opcional).
 * Categorias que ficam sem produtos somem da lista.
 */
export function filtrarCategorias(
  categorias: CardapioPublico["categorias"],
  categoriaId: string | null,
  busca: string,
): CardapioPublico["categorias"] {
  const termo = normalizar(busca);
  return categorias
    .filter((c) => categoriaId === null || c.id === categoriaId)
    .map((c) => ({
      ...c,
      produtos: termo ? c.produtos.filter((p) => normalizar(p.nome).includes(termo)) : c.produtos,
    }))
    .filter((c) => c.produtos.length > 0);
}
