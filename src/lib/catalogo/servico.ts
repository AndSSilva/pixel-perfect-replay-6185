import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { TipoAjuste } from "./estoque";
import { ErroCatalogo, codigoDoErroBanco, type Categoria, type Mesa, type Produto } from "./tipos";

// Acesso aos dados do catálogo (categorias, produtos, mesas e fotos) da empresa em uso.
// Toda leitura/escrita passa pelas regras de acesso do banco (RLS): master ou administrador vinculado.

export const BUCKET_FOTOS = "produtos-fotos";

export const chaveCategorias = (empresaId: string) => ["categorias", empresaId] as const;
export const chaveProdutos = (empresaId: string) => ["produtos", empresaId] as const;
export const chaveMesas = (empresaId: string) => ["mesas", empresaId] as const;

function falhar(
  etapa: string,
  e: { code?: string | undefined; message?: string | undefined },
): never {
  console.error("[catalogo]", etapa, { codigo: e.code, mensagem: e.message });
  throw new ErroCatalogo(codigoDoErroBanco(e));
}

// ---------- Categorias ----------
export async function listarCategorias(empresaId: string): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from("categorias")
    .select("*")
    .eq("estabelecimento_id", empresaId)
    .order("nome");
  if (error) falhar("listarCategorias", error);
  return data;
}

export async function salvarCategoria(
  empresaId: string,
  dados: { id?: string | undefined; nome: string; descricao: string; ativa: boolean },
): Promise<void> {
  const campos = {
    nome: dados.nome.trim(),
    descricao: dados.descricao.trim() || null,
    ativa: dados.ativa,
  };
  if (!campos.nome) throw new ErroCatalogo("dados_invalidos");
  if (dados.id) {
    const { data, error } = await supabase
      .from("categorias")
      .update(campos)
      .eq("id", dados.id)
      .eq("estabelecimento_id", empresaId)
      .select("id");
    if (error) falhar("atualizarCategoria", error);
    if (data.length === 0) throw new ErroCatalogo("nao_encontrado");
  } else {
    const { error } = await supabase
      .from("categorias")
      .insert({ ...campos, estabelecimento_id: empresaId });
    if (error) falhar("criarCategoria", error);
  }
}

/** Se a categoria tiver produtos, move-os para `destinoId` antes de excluir (o banco recusa se sobrar algum). */
export async function excluirCategoria(
  empresaId: string,
  id: string,
  destinoId?: string,
): Promise<void> {
  if (destinoId) {
    if (destinoId === id) throw new ErroCatalogo("categoria_invalida");
    const mover = await supabase
      .from("produtos")
      .update({ categoria_id: destinoId })
      .eq("categoria_id", id)
      .eq("estabelecimento_id", empresaId);
    if (mover.error) falhar("moverProdutos", mover.error);
  }
  const { error } = await supabase
    .from("categorias")
    .delete()
    .eq("id", id)
    .eq("estabelecimento_id", empresaId);
  if (error) falhar("excluirCategoria", error);
}

// ---------- Mesas ----------
export async function listarMesas(empresaId: string): Promise<Mesa[]> {
  const { data, error } = await supabase
    .from("mesas")
    .select("*")
    .eq("estabelecimento_id", empresaId)
    .order("numero");
  if (error) falhar("listarMesas", error);
  return data;
}

export async function criarMesas(empresaId: string, numeros: readonly number[]): Promise<void> {
  if (numeros.length === 0) throw new ErroCatalogo("dados_invalidos");
  const { error } = await supabase
    .from("mesas")
    .insert(numeros.map((numero) => ({ estabelecimento_id: empresaId, numero })));
  if (error) falhar("criarMesas", error);
}

export async function definirMesaAtiva(
  empresaId: string,
  id: string,
  ativa: boolean,
): Promise<void> {
  const { data, error } = await supabase
    .from("mesas")
    .update({ ativa })
    .eq("id", id)
    .eq("estabelecimento_id", empresaId)
    .select("id");
  if (error) falhar("definirMesaAtiva", error);
  if (data.length === 0) throw new ErroCatalogo("nao_encontrado");
}

export async function excluirMesa(empresaId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("mesas")
    .delete()
    .eq("id", id)
    .eq("estabelecimento_id", empresaId);
  if (error) falhar("excluirMesa", error);
}

// ---------- Fotos ----------
export const urlFoto = (path: string | null): string | null =>
  path ? supabase.storage.from(BUCKET_FOTOS).getPublicUrl(path).data.publicUrl : null;

async function enviarFoto(empresaId: string, produtoId: string, blob: Blob): Promise<string> {
  // Nome novo a cada envio: evita foto antiga em cache depois de trocar.
  const path = `${empresaId}/${produtoId}-${Date.now().toString(36)}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) {
    console.error("[catalogo] enviarFoto", { mensagem: error.message });
    throw new ErroCatalogo("foto_falhou");
  }
  return path;
}

/** Apagar foto é "melhor esforço": uma sobra no armazenamento não deve quebrar a operação principal. */
async function apagarFoto(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET_FOTOS).remove([path]);
  if (error) console.error("[catalogo] apagarFoto", { mensagem: error.message });
}

// ---------- Produtos ----------
export async function listarProdutos(empresaId: string): Promise<Produto[]> {
  const { data, error } = await supabase
    .from("produtos")
    .select("*")
    .eq("estabelecimento_id", empresaId)
    .order("nome");
  if (error) falhar("listarProdutos", error);
  return data;
}

export interface DadosProduto {
  id?: string | undefined;
  nome: string;
  descricao: string;
  categoriaId: string;
  precoVendaCentavos: number;
  precoCustoCentavos: number | null;
  /** Estoque inicial: só vale na criação (depois, o estoque muda por ajustes com histórico). */
  estoqueQtd: number;
  /** Se verdadeiro, o produto fica indisponível sozinho quando o estoque zerar (por entrega). */
  inativarAoZerarEstoque: boolean;
  disponivel: boolean;
  /** Foto nova já reduzida (JPEG). `undefined` = não mexe na foto. */
  fotoNova?: Blob | undefined;
  /** Remove a foto atual (sem enviar outra). */
  removerFoto?: boolean | undefined;
}

/** Resultado: na criação com estoque inicial, informa se o saldo inicial foi registrado no histórico. */
export interface ResultadoSalvarProduto {
  estoqueInicialRegistrado: boolean;
}

export async function salvarProduto(
  empresaId: string,
  dados: DadosProduto,
  fotoAtual?: string | null,
): Promise<ResultadoSalvarProduto> {
  const base = {
    nome: dados.nome.trim(),
    descricao: dados.descricao.trim() || null,
    categoria_id: dados.categoriaId,
    preco_venda_centavos: dados.precoVendaCentavos,
    preco_custo_centavos: dados.precoCustoCentavos,
    inativar_ao_zerar_estoque: dados.inativarAoZerarEstoque,
    disponivel: dados.disponivel,
  };
  if (!base.nome || !dados.categoriaId) throw new ErroCatalogo("dados_invalidos");

  if (!dados.id) {
    const id = crypto.randomUUID();
    const foto = dados.fotoNova ? await enviarFoto(empresaId, id, dados.fotoNova) : null;
    const { error } = await supabase
      .from("produtos")
      .insert({ ...base, id, estabelecimento_id: empresaId, foto_path: foto });
    if (error) {
      await apagarFoto(foto); // não deixa foto órfã se o cadastro falhar
      falhar("criarProduto", error);
    }
    // O estoque físico só muda por movimento registrado: o inicial entra como "saldo inicial".
    if (dados.estoqueQtd > 0) {
      const r = await supabase.rpc("ajustar_estoque", {
        _produto: id,
        _tipo: "saldo_inicial",
        _quantidade: dados.estoqueQtd,
      });
      if (r.error) {
        console.error("[catalogo] saldo inicial", {
          codigo: r.error.code,
          mensagem: r.error.message,
        });
        return { estoqueInicialRegistrado: false };
      }
    }
    return { estoqueInicialRegistrado: true };
  }

  const novaFoto = dados.fotoNova
    ? await enviarFoto(empresaId, dados.id, dados.fotoNova)
    : undefined;
  const campos =
    novaFoto !== undefined
      ? { ...base, foto_path: novaFoto }
      : dados.removerFoto
        ? { ...base, foto_path: null }
        : base;
  const { data, error } = await supabase
    .from("produtos")
    .update(campos)
    .eq("id", dados.id)
    .eq("estabelecimento_id", empresaId)
    .select("id");
  if (error || data.length === 0) {
    await apagarFoto(novaFoto);
    if (error) falhar("atualizarProduto", error);
    throw new ErroCatalogo("nao_encontrado");
  }
  if (novaFoto !== undefined || dados.removerFoto) await apagarFoto(fotoAtual);
  return { estoqueInicialRegistrado: true };
}

// ---------- Estoque (histórico de movimentos) ----------
export const chaveMovimentos = (produtoId: string) => ["movimentos", produtoId] as const;

export type MovimentoEstoque = Database["public"]["Tables"]["movimentos_estoque"]["Row"];

/** Lança um ajuste manual e devolve o novo saldo. A função do banco decide e registra no histórico. */
export async function ajustarEstoque(dados: {
  produtoId: string;
  tipo: TipoAjuste;
  quantidade: number;
  observacao: string;
}): Promise<number> {
  const { data, error } = await supabase.rpc("ajustar_estoque", {
    _produto: dados.produtoId,
    _tipo: dados.tipo,
    _quantidade: dados.quantidade,
    ...(dados.observacao.trim() ? { _observacao: dados.observacao.trim() } : {}),
  });
  if (error) falhar("ajustarEstoque", error);
  return data;
}

export async function listarMovimentos(produtoId: string): Promise<MovimentoEstoque[]> {
  const { data, error } = await supabase
    .from("movimentos_estoque")
    .select("*")
    .eq("produto_id", produtoId)
    .order("criado_em", { ascending: false })
    .limit(200);
  if (error) falhar("listarMovimentos", error);
  return data;
}

export async function definirProdutoDisponivel(
  empresaId: string,
  id: string,
  disponivel: boolean,
): Promise<void> {
  const { data, error } = await supabase
    .from("produtos")
    .update({ disponivel })
    .eq("id", id)
    .eq("estabelecimento_id", empresaId)
    .select("id");
  if (error) falhar("definirProdutoDisponivel", error);
  if (data.length === 0) throw new ErroCatalogo("nao_encontrado");
}

export async function excluirProduto(
  empresaId: string,
  produto: Pick<Produto, "id" | "foto_path">,
): Promise<void> {
  const { error } = await supabase
    .from("produtos")
    .delete()
    .eq("id", produto.id)
    .eq("estabelecimento_id", empresaId);
  if (error) falhar("excluirProduto", error);
  await apagarFoto(produto.foto_path);
}
