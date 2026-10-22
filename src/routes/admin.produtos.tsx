import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Camera, ImagePlus, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Campo, Confirmar, EmptyState, PageHeader, Selo, iconeCategoria } from "@/components/app/common";
import type { Erros } from "@/components/app/common";
import { executar, useDados } from "@/lib/store";
import { alternarDisponibilidade, excluirProduto, salvarProduto } from "@/lib/services/regras";
import { centavosParaInput, formatBRL, parseMoeda } from "@/lib/format";
import { arquivoParaDataUrl } from "@/lib/imagem";
import type { Produto } from "@/lib/types";

export const Route = createFileRoute("/admin/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Gestão de Bebidas" },
      { name: "description", content: "Cadastro e disponibilidade das bebidas do catálogo." },
      { property: "og:title", content: "Produtos — Gestão de Bebidas" },
      { property: "og:description", content: "Cadastro e disponibilidade das bebidas do catálogo." },
    ],
  }),
  component: Produtos,
});

type Form = { id?: string; nome: string; descricao: string; categoriaId: string; preco: string; disponivel: boolean };

function Produtos() {
  const d = useDados()!;
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [form, setForm] = useState<Form | null>(null);
  const [erros, setErros] = useState<Erros>({});

  const lista = d.produtos
    .filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    .filter((p) => filtro === "todas" || p.categoriaId === filtro)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const abrir = (p?: Produto) => {
    setErros({});
    setForm(
      p
        ? { id: p.id, nome: p.nome, descricao: p.descricao ?? "", categoriaId: p.categoriaId, preco: centavosParaInput(p.precoCentavos), disponivel: p.disponivel }
        : { nome: "", descricao: "", categoriaId: d.categorias[0]?.id ?? "", preco: "", disponivel: true },
    );
  };

  const salvar = () => {
    if (!form) return;
    const e: Erros = {};
    if (!form.nome.trim()) e.nome = "Informe o nome.";
    if (!form.categoriaId) e.categoria = "Selecione uma categoria.";
    const preco = parseMoeda(form.preco);
    if (preco === null) e.preco = "Informe um preço válido (ex.: 12,50).";
    setErros(e);
    if (Object.keys(e).length) return;
    const r = executar((x) => salvarProduto(x, { ...form, precoCentavos: preco }), form.id ? "Produto atualizado." : "Produto cadastrado.");
    if (r.ok) setForm(null);
  };

  return (
    <>
      <PageHeader
        titulo="Produtos"
        descricao={`${d.produtos.length} produtos cadastrados`}
        acoes={<Button onClick={() => abrir()} disabled={d.categorias.length === 0}><Plus className="h-4 w-4" /> Novo produto</Button>}
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar produto" placeholder="Buscar por nome" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="sm:w-56" aria-label="Filtrar por categoria"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {d.categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {lista.length === 0 ? (
        <EmptyState icone={Package} titulo="Nenhum produto encontrado" texto={d.categorias.length === 0 ? "Cadastre uma categoria primeiro." : "Ajuste a busca ou cadastre um novo produto."} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((p) => {
            const cat = d.categorias.find((c) => c.id === p.categoriaId);
            const Icone = iconeCategoria(cat?.nome);
            return (
              <article key={p.id} className="flex gap-3 rounded-xl border bg-card p-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icone className="h-6 w-6 text-muted-foreground" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-medium">{p.nome}</h3>
                    <span className="tabular font-semibold">{formatBRL(p.precoCentavos)}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{cat?.nome ?? "Sem categoria"}{p.descricao && ` · ${p.descricao}`}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={p.disponivel} onCheckedChange={() => executar((x) => alternarDisponibilidade(x, p.id))} aria-label="Disponível" />
                      {p.disponivel ? <Selo tom="sucesso">Disponível</Selo> : <Selo tom="neutro">Indisponível</Selo>}
                    </label>
                    <div className="flex">
                      <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => abrir(p)}><Pencil className="h-4 w-4" /></Button>
                      <Confirmar
                        gatilho={<Button size="icon" variant="ghost" aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>}
                        titulo={`Excluir ${p.nome}?`}
                        descricao="O produto sai do catálogo. Pedidos anteriores mantêm o nome e o preço registrados."
                        rotuloAcao="Excluir"
                        perigo
                        onConfirmar={() => executar((x) => excluirProduto(x, p.id), "Produto excluído.")}
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          {form && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
              <Campo id="nome" rotulo="Nome *" erro={erros.nome}>
                <Input id="nome" value={form.nome} maxLength={60} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </Campo>
              <Campo id="desc" rotulo="Descrição">
                <Textarea id="desc" value={form.descricao} maxLength={140} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </Campo>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo id="cat" rotulo="Categoria *" erro={erros.categoria}>
                  <Select value={form.categoriaId} onValueChange={(v) => setForm({ ...form, categoriaId: v })}>
                    <SelectTrigger id="cat"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{d.categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </Campo>
                <Campo id="preco" rotulo="Preço (R$) *" erro={erros.preco}>
                  <Input id="preco" inputMode="decimal" placeholder="0,00" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} />
                </Campo>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="disp" checked={form.disponivel} onCheckedChange={(v) => setForm({ ...form, disponivel: v })} />
                <Label htmlFor="disp">Disponível para pedidos</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
