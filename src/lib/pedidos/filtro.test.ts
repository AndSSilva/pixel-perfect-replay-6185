import { describe, expect, it } from "vitest";
import { filtrarCategorias, normalizar } from "./filtro";
import type { CardapioPublico } from "./tipos";

const p = (id: string, nome: string) => ({
  id,
  nome,
  descricao: null,
  preco_venda_centavos: 100,
  foto_path: null,
  esgotado: false,
  qtd_disponivel: null,
});
const cats: CardapioPublico["categorias"] = [
  { id: "c1", nome: "Cervejas", descricao: null, produtos: [p("a", "Heineken"), p("b", "Brahma")] },
  { id: "c2", nome: "Cafés", descricao: null, produtos: [p("c", "Café expresso")] },
];

describe("filtro do cardápio", () => {
  it("normaliza acentos e caixa", () => {
    expect(normalizar("  CAFÉ ")).toBe("cafe");
  });
  it("sem filtros devolve tudo", () => {
    expect(filtrarCategorias(cats, null, "")).toHaveLength(2);
  });
  it("filtra por categoria", () => {
    expect(filtrarCategorias(cats, "c2", "").map((c) => c.id)).toEqual(["c2"]);
  });
  it("busca por nome ignorando acento e some com categoria vazia", () => {
    const r = filtrarCategorias(cats, null, "cafe");
    expect(r.map((c) => c.id)).toEqual(["c2"]);
    expect(filtrarCategorias(cats, null, "BRAH")[0]?.produtos.map((x) => x.id)).toEqual(["b"]);
  });
  it("categoria e busca juntas", () => {
    expect(filtrarCategorias(cats, "c1", "cafe")).toEqual([]);
  });
});
