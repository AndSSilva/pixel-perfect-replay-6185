import { beforeEach, describe, expect, it, vi } from "vitest";

type Res = { data?: unknown; error?: unknown };
const m = vi.hoisted(() => ({
  chamadas: [] as [string, string, unknown, [string, unknown][]][],
  resolver: (() => ({})) as (tabela: string, op: string) => Res,
  upload: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (tabela: string) => {
    let op = "select";
    let dados: unknown;
    const filtros: [string, unknown][] = [];
    const resultado = () => {
      m.chamadas.push([tabela, op, dados, [...filtros]]);
      return Promise.resolve({ data: [], error: null, ...m.resolver(tabela, op) });
    };
    const b: Record<string, unknown> = {
      select: () => b,
      order: () => b,
      limit: () => b,
      insert: (d: unknown) => ((op = "insert"), (dados = d), b),
      update: (d: unknown) => ((op = "update"), (dados = d), b),
      delete: () => ((op = "delete"), b),
      eq: (c: string, v: unknown) => (filtros.push([c, v]), b),
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => resultado().then(ok, ko),
    };
    return b;
  };
  return {
    supabase: {
      from,
      rpc: m.rpc,
      storage: {
        from: () => ({
          upload: m.upload,
          remove: m.remove,
          getPublicUrl: (p: string) => ({ data: { publicUrl: `https://x/${p}` } }),
        }),
      },
    },
  };
});

import { ErroCatalogo, codigoDoErroBanco } from "./tipos";
import {
  ajustarEstoque,
  excluirCategoria,
  excluirProduto,
  listarMovimentos,
  salvarCategoria,
  salvarProduto,
  urlFoto,
} from "./servico";

const E = "22222222-2222-4222-8222-222222222222";
const dadosProduto = {
  nome: " Heineken ",
  descricao: "",
  categoriaId: "c1",
  precoVendaCentavos: 1200,
  precoCustoCentavos: 700,
  estoqueQtd: 10,
  inativarAoZerarEstoque: false,
  disponivel: true,
};

beforeEach(() => {
  m.chamadas.length = 0;
  m.resolver = () => ({});
  m.upload.mockReset().mockResolvedValue({ error: null });
  m.remove.mockReset().mockResolvedValue({ error: null });
  m.rpc.mockReset().mockResolvedValue({ data: 0, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("codigoDoErroBanco", () => {
  it("mapeia os erros do Postgres", () => {
    expect(
      codigoDoErroBanco({
        code: "23505",
        message: 'duplicate key value violates unique constraint "categorias_nome_unico"',
      }),
    ).toBe("nome_duplicado");
    expect(
      codigoDoErroBanco({
        code: "23505",
        message: 'duplicate key value violates unique constraint "mesas_numero_unico"',
      }),
    ).toBe("mesa_duplicada");
    expect(
      codigoDoErroBanco({
        code: "23503",
        message:
          'update or delete on table "categorias" violates foreign key constraint "produtos_categoria_fkey" on table "produtos"',
      }),
    ).toBe("categoria_com_produtos");
    expect(
      codigoDoErroBanco({
        code: "23503",
        message:
          'insert or update on table "produtos" violates foreign key constraint "produtos_categoria_fkey"',
      }),
    ).toBe("categoria_invalida");
    expect(codigoDoErroBanco({ code: "23514", message: "check" })).toBe("dados_invalidos");
    expect(codigoDoErroBanco({ code: "42501", message: "rls" })).toBe("sem_permissao");
    expect(codigoDoErroBanco({ code: "XX", message: "?" })).toBe("desconhecido");
  });
});

describe("categorias", () => {
  it("cria com os campos limpos e a empresa", async () => {
    await salvarCategoria(E, { nome: "  Cervejas ", descricao: " ", ativa: true });
    expect(m.chamadas[0]).toEqual([
      "categorias",
      "insert",
      { nome: "Cervejas", descricao: null, ativa: true, estabelecimento_id: E },
      [],
    ]);
  });
  it("não aceita nome vazio", async () => {
    await expect(
      salvarCategoria(E, { nome: "  ", descricao: "", ativa: true }),
    ).rejects.toMatchObject({ codigo: "dados_invalidos" });
  });
  it("editar um registro que sumiu → não encontrado", async () => {
    m.resolver = () => ({ data: [] });
    await expect(
      salvarCategoria(E, { id: "x", nome: "A", descricao: "", ativa: true }),
    ).rejects.toMatchObject({ codigo: "nao_encontrado" });
  });
  it("excluir com destino: move os produtos antes de apagar, sempre dentro da empresa", async () => {
    await excluirCategoria(E, "c1", "c2");
    expect(m.chamadas.map((c) => `${c[0]}:${c[1]}`)).toEqual([
      "produtos:update",
      "categorias:delete",
    ]);
    expect(m.chamadas[0]![2]).toEqual({ categoria_id: "c2" });
    expect(m.chamadas[0]![3]).toContainEqual(["estabelecimento_id", E]);
  });
  it("excluir categoria que ainda tem produtos → erro claro do banco", async () => {
    m.resolver = (t, op) =>
      t === "categorias" && op === "delete"
        ? {
            error: {
              code: "23503",
              message:
                'update or delete on table "categorias" violates foreign key constraint "x" on table "produtos"',
            },
          }
        : {};
    await expect(excluirCategoria(E, "c1")).rejects.toMatchObject({
      codigo: "categoria_com_produtos",
    });
  });
  it("não move para ela mesma", async () => {
    await expect(excluirCategoria(E, "c1", "c1")).rejects.toBeInstanceOf(ErroCatalogo);
    expect(m.chamadas).toHaveLength(0);
  });
});

describe("produtos e fotos", () => {
  it("cria sem foto", async () => {
    await salvarProduto(E, dadosProduto);
    const ins = m.chamadas.find((c) => c[1] === "insert")!;
    expect(ins[2]).toMatchObject({
      nome: "Heineken",
      descricao: null,
      preco_venda_centavos: 1200,
      preco_custo_centavos: 700,
      inativar_ao_zerar_estoque: false,
      estabelecimento_id: E,
      foto_path: null,
    });
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("grava a regra de inativar sozinho ao zerar o estoque", async () => {
    await salvarProduto(E, { ...dadosProduto, inativarAoZerarEstoque: true });
    expect(m.chamadas.find((c) => c[1] === "insert")![2]).toMatchObject({
      inativar_ao_zerar_estoque: true,
    });
  });
  it("cria com foto: envia para a pasta da empresa e grava o caminho", async () => {
    await salvarProduto(E, { ...dadosProduto, fotoNova: new Blob(["x"]) });
    const path = m.upload.mock.calls[0]![0] as string;
    expect(path.startsWith(`${E}/`)).toBe(true);
    expect(m.chamadas.find((c) => c[1] === "insert")![2]).toMatchObject({ foto_path: path });
  });
  it("se o cadastro falhar depois do envio, apaga a foto (sem órfã)", async () => {
    m.resolver = (t, op) =>
      t === "produtos" && op === "insert" ? { error: { code: "23514", message: "check" } } : {};
    await expect(
      salvarProduto(E, { ...dadosProduto, fotoNova: new Blob(["x"]) }),
    ).rejects.toMatchObject({ codigo: "dados_invalidos" });
    expect(m.remove).toHaveBeenCalledWith([m.upload.mock.calls[0]![0]]);
  });
  it("falha no envio da foto → erro de foto e nada é cadastrado", async () => {
    m.upload.mockResolvedValue({ error: { message: "boom" } });
    await expect(
      salvarProduto(E, { ...dadosProduto, fotoNova: new Blob(["x"]) }),
    ).rejects.toMatchObject({ codigo: "foto_falhou" });
    expect(m.chamadas.some((c) => c[1] === "insert")).toBe(false);
  });
  it("trocar a foto apaga a antiga só depois de gravar a nova", async () => {
    m.resolver = (t, op) => (op === "update" ? { data: [{ id: "p1" }] } : {});
    await salvarProduto(
      E,
      { ...dadosProduto, id: "p1", fotoNova: new Blob(["x"]) },
      `${E}/antiga.jpg`,
    );
    const nova = m.upload.mock.calls[0]![0] as string;
    expect(m.chamadas.find((c) => c[1] === "update")![2]).toMatchObject({ foto_path: nova });
    expect(m.remove).toHaveBeenCalledWith([`${E}/antiga.jpg`]);
  });
  it("remover a foto limpa o caminho e apaga o arquivo", async () => {
    m.resolver = (t, op) => (op === "update" ? { data: [{ id: "p1" }] } : {});
    await salvarProduto(E, { ...dadosProduto, id: "p1", removerFoto: true }, `${E}/antiga.jpg`);
    expect(m.chamadas.find((c) => c[1] === "update")![2]).toMatchObject({ foto_path: null });
    expect(m.remove).toHaveBeenCalledWith([`${E}/antiga.jpg`]);
  });
  it("editar sem mexer na foto não toca no armazenamento nem no caminho", async () => {
    m.resolver = (t, op) => (op === "update" ? { data: [{ id: "p1" }] } : {});
    await salvarProduto(E, { ...dadosProduto, id: "p1" }, `${E}/antiga.jpg`);
    expect(m.chamadas.find((c) => c[1] === "update")![2]).not.toHaveProperty("foto_path");
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("excluir produto apaga a foto também", async () => {
    await excluirProduto(E, { id: "p1", foto_path: `${E}/f.jpg` });
    expect(m.remove).toHaveBeenCalledWith([`${E}/f.jpg`]);
  });
  it("monta a URL pública da foto", () => {
    expect(urlFoto(`${E}/f.jpg`)).toBe(`https://x/${E}/f.jpg`);
    expect(urlFoto(null)).toBeNull();
  });
});

describe("estoque", () => {
  it("o estoque físico não vai no cadastro do produto (só por movimento)", async () => {
    await salvarProduto(E, dadosProduto);
    const ins = m.chamadas.find((c) => c[1] === "insert")!;
    expect(ins[2]).not.toHaveProperty("estoque_qtd");
    m.resolver = (t, op) => (op === "update" ? { data: [{ id: "p1" }] } : {});
    await salvarProduto(E, { ...dadosProduto, id: "p1" });
    expect(m.chamadas.find((c) => c[1] === "update")![2]).not.toHaveProperty("estoque_qtd");
  });
  it("estoque inicial vira um movimento de saldo inicial", async () => {
    const r = await salvarProduto(E, { ...dadosProduto, estoqueQtd: 10 });
    expect(r).toEqual({ estoqueInicialRegistrado: true });
    expect(m.rpc).toHaveBeenCalledWith("ajustar_estoque", {
      _produto: expect.any(String),
      _tipo: "saldo_inicial",
      _quantidade: 10,
    });
  });
  it("sem estoque inicial, não registra movimento", async () => {
    await salvarProduto(E, { ...dadosProduto, estoqueQtd: 0 });
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("se o saldo inicial falhar, o produto fica salvo e o resultado avisa", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "boom" } });
    expect(await salvarProduto(E, { ...dadosProduto, estoqueQtd: 10 })).toEqual({
      estoqueInicialRegistrado: false,
    });
    expect(m.chamadas.some((c) => c[1] === "insert")).toBe(true);
  });
  it("ajuste manual chama a função do banco e devolve o novo saldo", async () => {
    m.rpc.mockResolvedValue({ data: 17, error: null });
    expect(
      await ajustarEstoque({
        produtoId: "p1",
        tipo: "reposicao",
        quantidade: 7,
        observacao: " Compra ",
      }),
    ).toBe(17);
    expect(m.rpc).toHaveBeenCalledWith("ajustar_estoque", {
      _produto: "p1",
      _tipo: "reposicao",
      _quantidade: 7,
      _observacao: "Compra",
    });
    await ajustarEstoque({ produtoId: "p1", tipo: "reposicao", quantidade: 1, observacao: "  " });
    expect(m.rpc).toHaveBeenLastCalledWith("ajustar_estoque", {
      _produto: "p1",
      _tipo: "reposicao",
      _quantidade: 1,
    });
  });
  it("erros da função viram mensagens claras", async () => {
    m.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "estoque_insuficiente" },
    });
    await expect(
      ajustarEstoque({ produtoId: "p1", tipo: "baixa_avaria", quantidade: 99, observacao: "x" }),
    ).rejects.toMatchObject({ codigo: "estoque_insuficiente" });
    m.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "observacao_obrigatoria" },
    });
    await expect(
      ajustarEstoque({
        produtoId: "p1",
        tipo: "alteracao_quantidade",
        quantidade: 3,
        observacao: "",
      }),
    ).rejects.toMatchObject({ codigo: "estoque_invalido" });
    m.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "sem_permissao" } });
    await expect(
      ajustarEstoque({ produtoId: "p1", tipo: "reposicao", quantidade: 1, observacao: "" }),
    ).rejects.toMatchObject({ codigo: "sem_permissao" });
  });
  it("lista os movimentos de um produto", async () => {
    m.resolver = () => ({ data: [{ id: "m1" }] });
    expect(await listarMovimentos("p1")).toEqual([{ id: "m1" }]);
    expect(m.chamadas.at(-1)![3]).toContainEqual(["produto_id", "p1"]);
  });
});
