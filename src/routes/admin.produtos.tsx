import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Camera,
  ImagePlus,
  Layers,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Campo,
  Confirmar,
  EmptyState,
  PageHeader,
  Selo,
  iconeCategoria,
} from "@/components/app/common";
import { estadoDaConsulta } from "@/components/app/Consulta";
import { EstoqueDialog } from "@/components/catalogo/EstoqueDialog";
import { useEmpresa } from "@/lib/empresa/contexto";
import { formatarMargem, lucroCentavos, margemPercentual } from "@/lib/catalogo/calculos";
import {
  chaveCategorias,
  chaveComboItens,
  chaveProdutos,
  definirProdutoDisponivel,
  excluirProduto,
  listarCategorias,
  listarComboItens,
  listarProdutos,
  salvarProduto,
  urlFoto,
} from "@/lib/catalogo/servico";
import {
  COMBO_MAX_COMPONENTES,
  combosPossiveis,
  custoDoCombo,
  textoInclui,
  validarComponentes,
  type ComponenteCombo,
} from "@/lib/catalogo/combo";
import { ESTOQUE_MAX } from "@/lib/catalogo/estoque";
import { mensagemDoErro } from "@/lib/catalogo/mensagem";
import { MENSAGENS_CATALOGO, type Produto } from "@/lib/catalogo/tipos";
import { centavosParaInput, formatBRL, parseMoeda } from "@/lib/format";
import { arquivoParaDataUrl, dataUrlParaBlob } from "@/lib/imagem";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/produtos")({
  head: () => ({
    meta: [
      { title: "Comanda Fácil - Administrador" },
      { name: "description", content: "Cadastro, preços, estoque e disponibilidade dos produtos." },
    ],
  }),
  component: Produtos,
});

type Form = {
  id?: string;
  nome: string;
  descricao: string;
  categoriaId: string;
  venda: string;
  custo: string;
  estoque: string;
  inativarAoZerar: boolean;
  disponivel: boolean;
  /** Combo: baixa o estoque dos produtos vinculados (sem estoque nem custo próprios). */
  ehCombo: boolean;
  eraCombo: boolean;
  componentes: { produtoId: string; quantidade: string }[];
  /** Caminho da foto já salva (para mostrar e para apagar na troca). */
  fotoPath: string | null;
  /** Foto escolhida agora, já reduzida (data URL), ainda não enviada. */
  fotoNova?: string | undefined;
  removerFoto: boolean;
};
type Erros = Partial<
  Record<"nome" | "categoria" | "venda" | "custo" | "estoque" | "combo", string>
>;

function Produtos() {
  const empresa = useEmpresa();
  const qc = useQueryClient();
  const categorias = useQuery({
    queryKey: chaveCategorias(empresa.id),
    queryFn: () => listarCategorias(empresa.id),
  });
  const produtos = useQuery({
    queryKey: chaveProdutos(empresa.id),
    queryFn: () => listarProdutos(empresa.id),
  });
  const comboItens = useQuery({
    queryKey: chaveComboItens(empresa.id),
    queryFn: () => listarComboItens(empresa.id),
  });
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [form, setForm] = useState<Form | null>(null);
  const [estoqueDeId, setEstoqueDeId] = useState<string | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string>();

  const cats = categorias.data ?? [];
  const todos = produtos.data ?? [];
  const atualizar = async () => {
    await qc.invalidateQueries({ queryKey: chaveProdutos(empresa.id) });
    await qc.invalidateQueries({ queryKey: chaveComboItens(empresa.id) });
  };
  const porId = new Map(todos.map((p) => [p.id, p]));
  const componentesDe = (comboId: string): ComponenteCombo[] =>
    (comboItens.data ?? [])
      .filter((c) => c.combo_id === comboId)
      .map((c) => ({ produtoId: c.componente_id, quantidade: c.quantidade }));
  const emCombo = new Set((comboItens.data ?? []).map((c) => c.componente_id));

  const salvar = useMutation({
    mutationFn: async (v: { form: Form; venda: number; custo: number | null; estoque: number }) => {
      const f = v.form;
      return salvarProduto(
        empresa.id,
        {
          id: f.id,
          nome: f.nome,
          descricao: f.descricao,
          categoriaId: f.categoriaId,
          precoVendaCentavos: v.venda,
          precoCustoCentavos: v.custo,
          estoqueQtd: v.estoque,
          inativarAoZerarEstoque: f.ehCombo ? false : f.inativarAoZerar,
          disponivel: f.disponivel,
          combo: f.ehCombo
            ? f.componentes.map((c) => ({
                produtoId: c.produtoId,
                quantidade: Number(c.quantidade),
              }))
            : f.eraCombo
              ? []
              : undefined,
          fotoNova: f.fotoNova ? await dataUrlParaBlob(f.fotoNova) : undefined,
          removerFoto: f.removerFoto && !f.fotoNova,
        },
        f.fotoPath,
      );
    },
    onSuccess: async (r, v) => {
      await atualizar();
      if (!r.comboRegistrado) toast.warning(MENSAGENS_CATALOGO.combo_nao_registrado);
      else if (r.estoqueInicialRegistrado)
        toast.success(v.form.id ? "Produto atualizado." : "Produto cadastrado.");
      else toast.warning(MENSAGENS_CATALOGO.estoque_nao_registrado);
      setForm(null);
    },
    onError: (e) => setErroGeral(mensagemDoErro(e)),
  });
  const alternar = useMutation({
    mutationFn: (v: { id: string; disponivel: boolean }) =>
      definirProdutoDisponivel(empresa.id, v.id, v.disponivel),
    onSuccess: atualizar,
    onError: (e) => toast.error(mensagemDoErro(e)),
  });
  const excluir = useMutation({
    mutationFn: (p: Produto) => excluirProduto(empresa.id, p),
    onSuccess: async () => {
      await atualizar();
      toast.success("Produto excluído.");
    },
    onError: (e) => toast.error(mensagemDoErro(e)),
  });

  const lista = todos
    .filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    .filter((p) => filtro === "todas" || p.categoria_id === filtro)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const abrir = (p?: Produto) => {
    setErros({});
    setErroGeral(undefined);
    setForm(
      p
        ? {
            id: p.id,
            nome: p.nome,
            descricao: p.descricao ?? "",
            categoriaId: p.categoria_id,
            venda: centavosParaInput(p.preco_venda_centavos),
            custo: p.preco_custo_centavos === null ? "" : centavosParaInput(p.preco_custo_centavos),
            estoque: String(p.estoque_qtd),
            inativarAoZerar: p.inativar_ao_zerar_estoque,
            disponivel: p.disponivel,
            ehCombo: p.eh_combo,
            eraCombo: p.eh_combo,
            componentes: componentesDe(p.id).map((c) => ({
              produtoId: c.produtoId,
              quantidade: String(c.quantidade),
            })),
            fotoPath: p.foto_path,
            removerFoto: false,
          }
        : {
            nome: "",
            descricao: "",
            categoriaId: cats[0]?.id ?? "",
            venda: "",
            custo: "",
            estoque: "0",
            inativarAoZerar: false,
            disponivel: true,
            ehCombo: false,
            eraCombo: false,
            componentes: [],
            fotoPath: null,
            removerFoto: false,
          },
    );
  };

  const enviar = () => {
    if (!form) return;
    const e: Erros = {};
    if (!form.nome.trim()) e.nome = "Informe o nome.";
    if (!form.categoriaId) e.categoria = "Selecione uma categoria.";
    const venda = parseMoeda(form.venda);
    if (venda === null) e.venda = "Informe um preço válido (ex.: 12,50).";
    // Combo não tem custo próprio: é a soma dos componentes (calculada na hora do pedido).
    const custoTexto = form.ehCombo ? "" : form.custo.trim();
    const custo = custoTexto === "" ? null : parseMoeda(custoTexto);
    if (custoTexto !== "" && custo === null)
      e.custo = "Informe um valor válido (ex.: 7,00) ou deixe em branco.";
    // O estoque só é informado na criação; depois muda apenas por lançamentos com histórico.
    const estoqueTexto = form.estoque.trim();
    const estoque =
      form.id || form.ehCombo ? 0 : /^\d+$/.test(estoqueTexto) ? Number(estoqueTexto) : NaN;
    if (form.ehCombo) {
      const msg = validarComponentes(form.componentes);
      if (msg) e.combo = msg;
    }
    if (!form.id && !form.ehCombo && !(estoque >= 0 && estoque <= ESTOQUE_MAX))
      e.estoque = "Informe um número inteiro (0 ou mais).";
    setErros(e);
    if (Object.keys(e).length || venda === null) return;
    setErroGeral(undefined);
    salvar.mutate({ form, venda, custo, estoque });
  };

  // Lucro mostrado ao vivo no formulário.
  const vendaForm = form ? parseMoeda(form.venda) : null;
  const custoComboForm =
    form && form.ehCombo
      ? custoDoCombo(
          form.componentes
            .filter((c) => /^\d+$/.test(c.quantidade.trim()) && Number(c.quantidade) > 0)
            .map((c) => ({ produtoId: c.produtoId, quantidade: Number(c.quantidade) })),
          porId,
        )
      : null;
  const custoForm =
    form && form.ehCombo
      ? custoComboForm
      : form && form.custo.trim() !== ""
        ? parseMoeda(form.custo)
        : null;
  const lucroForm =
    vendaForm !== null && custoForm !== null
      ? { preco_venda_centavos: vendaForm, preco_custo_centavos: custoForm }
      : null;

  const pronto = estadoDaConsulta(categorias) ?? estadoDaConsulta(produtos);
  return (
    <>
      <PageHeader
        titulo="Produtos"
        descricao={pronto ? undefined : `${todos.length} produtos cadastrados`}
        acoes={
          <Button onClick={() => abrir()} disabled={cats.length === 0}>
            <Plus className="h-4 w-4" /> Novo produto
          </Button>
        }
      />
      {pronto ? (
        pronto
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar produto"
                placeholder="Buscar por nome"
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select value={filtro} onValueChange={setFiltro}>
              <SelectTrigger className="sm:w-56" aria-label="Filtrar por categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {cats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {lista.length === 0 ? (
            <EmptyState
              icone={Package}
              titulo="Nenhum produto encontrado"
              texto={
                cats.length === 0
                  ? "Cadastre uma categoria primeiro."
                  : "Ajuste a busca ou cadastre um novo produto."
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lista.map((p) => {
                const cat = cats.find((c) => c.id === p.categoria_id);
                const Icone = iconeCategoria(cat?.nome);
                const foto = urlFoto(p.foto_path);
                const compsCombo = p.eh_combo ? componentesDe(p.id) : [];
                const custoEfetivo = p.eh_combo
                  ? custoDoCombo(compsCombo, porId)
                  : p.preco_custo_centavos;
                const lucro = lucroCentavos({ ...p, preco_custo_centavos: custoEfetivo });
                const possiveis = p.eh_combo ? combosPossiveis(compsCombo, porId) : null;
                return (
                  <article key={p.id} className="flex gap-3 rounded-xl border bg-card p-4">
                    {foto ? (
                      <img
                        src={foto}
                        alt=""
                        loading="lazy"
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icone className="h-6 w-6 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="flex min-w-0 items-center gap-1.5 font-medium">
                          <span className="truncate">{p.nome}</span>
                          {p.eh_combo && (
                            <Selo tom="neutro">
                              <Layers className="mr-1 inline h-3 w-3" aria-hidden />
                              Combo
                            </Selo>
                          )}
                        </h3>
                        <span className="tabular font-semibold">
                          {formatBRL(p.preco_venda_centavos)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {cat?.nome ?? "Sem categoria"}
                        {p.descricao && ` · ${p.descricao}`}
                      </p>
                      {p.eh_combo && compsCombo.length > 0 && (
                        <p className="truncate text-xs text-muted-foreground">
                          Inclui: {textoInclui(compsCombo, porId)}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {lucro === null ? (
                          p.eh_combo ? (
                            "Custo parcial (falta custo em algum item)"
                          ) : (
                            "Custo não informado"
                          )
                        ) : (
                          <>
                            Custo {formatBRL(custoEfetivo ?? 0)} · Lucro{" "}
                            <span
                              className={cn(
                                "tabular font-medium",
                                lucro >= 0 ? "text-success" : "text-destructive",
                              )}
                            >
                              {formatBRL(lucro)} ({formatarMargem(margemPercentual(p))})
                            </span>
                          </>
                        )}
                      </p>
                      <div className="mt-1.5">
                        {p.eh_combo ? (
                          <Selo tom={possiveis === 0 ? "alerta" : "neutro"}>
                            {possiveis === 0
                              ? "Sem estoque dos itens"
                              : `Dá para ${possiveis ?? 0} (pelo estoque dos itens)`}
                          </Selo>
                        ) : (
                          <Selo tom={p.estoque_qtd === 0 ? "alerta" : "neutro"}>
                            {p.estoque_qtd === 0 ? "Sem estoque" : `Estoque: ${p.estoque_qtd}`}
                          </Selo>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs">
                          <Switch
                            checked={p.disponivel}
                            disabled={alternar.isPending}
                            onCheckedChange={(v) => alternar.mutate({ id: p.id, disponivel: v })}
                            aria-label={`Disponível: ${p.nome}`}
                          />
                          {p.disponivel ? (
                            <Selo tom="sucesso">Disponível</Selo>
                          ) : (
                            <Selo tom="neutro">Indisponível</Selo>
                          )}
                        </label>
                        <div className="flex">
                          {!p.eh_combo && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Estoque de ${p.nome}`}
                              onClick={() => setEstoqueDeId(p.id)}
                            >
                              <Boxes className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Editar ${p.nome}`}
                            onClick={() => abrir(p)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Confirmar
                            gatilho={
                              <Button size="icon" variant="ghost" aria-label={`Excluir ${p.nome}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            }
                            titulo={`Excluir ${p.nome}?`}
                            descricao="O produto e a foto dele são removidos do catálogo."
                            rotuloAcao="Excluir"
                            perigo
                            onConfirmar={() => excluir.mutate(p)}
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && !salvar.isPending && setForm(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form
              className="space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                enviar();
              }}
            >
              <Campo id="nome" rotulo="Nome *" erro={erros.nome}>
                <Input
                  id="nome"
                  autoFocus
                  value={form.nome}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </Campo>
              <Campo id="desc" rotulo="Descrição">
                <Textarea
                  id="desc"
                  value={form.descricao}
                  maxLength={300}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </Campo>
              <Campo
                id="foto"
                rotulo="Foto do produto"
                dica="Tire uma foto na hora ou envie um arquivo. A imagem é reduzida antes de ser enviada."
              >
                <FotoProduto
                  imagem={form.fotoNova ?? (form.removerFoto ? null : urlFoto(form.fotoPath))}
                  onEscolher={(dataUrl) =>
                    setForm({ ...form, fotoNova: dataUrl, removerFoto: false })
                  }
                  onRemover={() => setForm({ ...form, fotoNova: undefined, removerFoto: true })}
                />
              </Campo>
              <Campo id="cat" rotulo="Categoria *" erro={erros.categoria}>
                <Select
                  value={form.categoriaId}
                  onValueChange={(v) => setForm({ ...form, categoriaId: v })}
                >
                  <SelectTrigger id="cat">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {cats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <ComboEditor
                form={form}
                onChange={setForm}
                erro={erros.combo}
                candidatos={todos.filter((x) => !x.eh_combo && x.id !== form.id)}
                bloqueio={
                  form.eraCombo
                    ? null
                    : form.id && emCombo.has(form.id)
                      ? "Este produto já faz parte de um combo, então não pode virar combo."
                      : (porId.get(form.id ?? "")?.estoque_qtd ?? 0) > 0
                        ? "Este produto tem estoque. Zere o estoque antes de transformá-lo em combo."
                        : null
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo id="venda" rotulo="Preço de venda (R$) *" erro={erros.venda}>
                  <Input
                    id="venda"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.venda}
                    onChange={(e) => setForm({ ...form, venda: e.target.value })}
                  />
                </Campo>
                {form.ehCombo ? (
                  <div className="space-y-1.5">
                    <Label>Preço de custo (R$)</Label>
                    <p className="rounded-md border bg-muted px-3 py-2 text-sm">
                      {custoComboForm === null ? (
                        <span className="text-muted-foreground">
                          Automático — falta custo em algum item
                        </span>
                      ) : (
                        <span className="tabular">{formatBRL(custoComboForm)}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Soma do custo dos produtos vinculados.
                    </p>
                  </div>
                ) : (
                  <Campo
                    id="custo"
                    rotulo="Preço de custo (R$)"
                    erro={erros.custo}
                    dica="Opcional. Com ele, o lucro é calculado."
                  >
                    <Input
                      id="custo"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.custo}
                      onChange={(e) => setForm({ ...form, custo: e.target.value })}
                    />
                  </Campo>
                )}
              </div>
              <p className="rounded-md bg-muted px-3 py-2 text-sm" aria-live="polite">
                {lucroForm ? (
                  <>
                    Lucro por unidade:{" "}
                    <span
                      className={cn(
                        "tabular font-semibold",
                        lucroCentavos(lucroForm)! >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {formatBRL(lucroCentavos(lucroForm)!)} (
                      {formatarMargem(margemPercentual(lucroForm))})
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Informe venda e custo para ver o lucro.
                  </span>
                )}
              </p>
              {form.ehCombo ? (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Combo não tem estoque próprio: ao ser entregue, baixa o estoque dos produtos
                  vinculados, e o cardápio só oferece quantos combos o estoque deles permitir.
                </p>
              ) : form.id ? (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  O estoque só muda por lançamentos com histórico. Para repor, corrigir ou dar
                  baixa, use o botão “Estoque” no cartão do produto.
                </p>
              ) : (
                <Campo
                  id="estoque"
                  rotulo="Estoque inicial (unidades)"
                  erro={erros.estoque}
                  dica="Fica registrado no histórico como saldo inicial."
                >
                  <Input
                    id="estoque"
                    inputMode="numeric"
                    value={form.estoque}
                    maxLength={7}
                    onChange={(e) => setForm({ ...form, estoque: e.target.value })}
                  />
                </Campo>
              )}
              {!form.ehCombo && (
                <div className="flex items-start gap-2">
                  <Switch
                    id="zerar"
                    className="mt-0.5"
                    checked={form.inativarAoZerar}
                    onCheckedChange={(v) => setForm({ ...form, inativarAoZerar: v })}
                  />
                  <Label htmlFor="zerar" className="leading-snug">
                    Inativar automaticamente quando o estoque zerar
                    <span className="block text-xs font-normal text-muted-foreground">
                      Ligado: depois da entrega que zerar o estoque, o produto fica indisponível
                      sozinho. Desligado: ele continua ativo e você decide quando inativar.
                    </span>
                  </Label>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  id="disp"
                  checked={form.disponivel}
                  onCheckedChange={(v) => setForm({ ...form, disponivel: v })}
                />
                <Label htmlFor="disp">Disponível para pedidos</Label>
              </div>
              {erroGeral && (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {erroGeral}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm(null)}
                  disabled={salvar.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvar.isPending}>
                  {salvar.isPending && <Loader2 className="animate-spin" aria-hidden />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <EstoqueDialog
        produto={todos.find((p) => p.id === estoqueDeId) ?? null}
        empresaId={empresa.id}
        onFechar={() => setEstoqueDeId(null)}
      />
    </>
  );
}

function ComboEditor({
  form,
  onChange,
  erro,
  candidatos,
  bloqueio,
}: {
  form: Form;
  onChange: (f: Form) => void;
  erro: string | undefined;
  candidatos: Produto[];
  /** Motivo pelo qual este produto não pode virar combo (só vale enquanto ainda não é combo). */
  bloqueio: string | null;
}) {
  const usados = new Set(form.componentes.map((c) => c.produtoId));
  const livres = candidatos.filter((c) => !usados.has(c.id));
  const trocar = (i: number, parte: Partial<{ produtoId: string; quantidade: string }>) =>
    onChange({
      ...form,
      componentes: form.componentes.map((c, j) => (j === i ? { ...c, ...parte } : c)),
    });
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <Switch
          id="combo"
          className="mt-0.5"
          checked={form.ehCombo}
          disabled={bloqueio !== null}
          onCheckedChange={(v) =>
            onChange({
              ...form,
              ehCombo: v,
              componentes:
                v && form.componentes.length === 0
                  ? [{ produtoId: "", quantidade: "1" }]
                  : form.componentes,
            })
          }
        />
        <Label htmlFor="combo" className="leading-snug">
          Combo
          <span className="block text-xs font-normal text-muted-foreground">
            {bloqueio ??
              "Ao entregar este produto, o estoque dos produtos vinculados abaixo é baixado."}
          </span>
        </Label>
      </div>
      {form.ehCombo && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Produtos do combo</p>
          {form.componentes.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select value={c.produtoId} onValueChange={(v) => trocar(i, { produtoId: v })}>
                <SelectTrigger className="flex-1" aria-label={`Produto ${i + 1} do combo`}>
                  <SelectValue placeholder="Escolha o produto" />
                </SelectTrigger>
                <SelectContent>
                  {candidatos
                    .filter((x) => x.id === c.produtoId || !usados.has(x.id))
                    .map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">×</span>
              <Input
                aria-label={`Quantidade do produto ${i + 1}`}
                inputMode="numeric"
                className="w-20"
                maxLength={2}
                value={c.quantidade}
                onChange={(e) => trocar(i, { quantidade: e.target.value })}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remover produto ${i + 1} do combo`}
                onClick={() =>
                  onChange({ ...form, componentes: form.componentes.filter((_, j) => j !== i) })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={livres.length === 0 || form.componentes.length >= COMBO_MAX_COMPONENTES}
            onClick={() =>
              onChange({
                ...form,
                componentes: [...form.componentes, { produtoId: "", quantidade: "1" }],
              })
            }
          >
            <Plus className="h-4 w-4" /> Adicionar produto
          </Button>
          {livres.length === 0 && form.componentes.every((c) => c.produtoId) && (
            <p className="text-xs text-muted-foreground">
              Cadastre antes os produtos que fazem parte do combo (ex.: a cerveja).
            </p>
          )}
          {erro && (
            <p role="alert" className="text-xs text-destructive">
              {erro}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FotoProduto({
  imagem,
  onEscolher,
  onRemover,
}: {
  imagem: string | null;
  onEscolher: (dataUrl: string) => void;
  onRemover: () => void;
}) {
  const inputArquivo = useRef<HTMLInputElement>(null);
  const inputCamera = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);

  const aoSelecionar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setProcessando(true);
    try {
      onEscolher(await arquivoParaDataUrl(arquivo));
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível usar esta imagem.");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {imagem ? (
        <div className="relative">
          <img
            src={imagem}
            alt="Foto do produto"
            className="h-20 w-20 rounded-lg border object-cover"
          />
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
            aria-label="Remover foto"
            onClick={onRemover}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed bg-muted text-muted-foreground">
          <ImagePlus className="h-6 w-6" aria-hidden />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={processando}
          onClick={() => inputCamera.current?.click()}
        >
          <Camera className="h-4 w-4" /> {processando ? "Processando…" : "Tirar foto"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={processando}
          onClick={() => inputArquivo.current?.click()}
        >
          <ImagePlus className="h-4 w-4" /> Enviar arquivo
        </Button>
      </div>
      <input
        ref={inputCamera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Tirar foto do produto"
        onChange={aoSelecionar}
      />
      <input
        ref={inputArquivo}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Enviar foto do produto"
        onChange={aoSelecionar}
      />
    </div>
  );
}
