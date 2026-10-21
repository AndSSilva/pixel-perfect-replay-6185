import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Campo, EmptyState, PageHeader, Selo, iconeCategoria } from "@/components/app/common";
import { executar, useDados } from "@/lib/store";
import { excluirCategoria, salvarCategoria } from "@/lib/services/regras";
import type { Categoria } from "@/lib/types";

export const Route = createFileRoute("/admin/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — Gestão de Bebidas" },
      { name: "description", content: "Organize as categorias do cardápio." },
      { property: "og:title", content: "Categorias — Gestão de Bebidas" },
      { property: "og:description", content: "Organize as categorias do cardápio." },
    ],
  }),
  component: Categorias,
});

function Categorias() {
  const d = useDados()!;
  const [form, setForm] = useState<{ id?: string; nome: string; descricao: string; ativa: boolean } | null>(null);
  const [erro, setErro] = useState<string>();
  const [excluindo, setExcluindo] = useState<Categoria | null>(null);
  const [destino, setDestino] = useState("");

  const salvar = () => {
    if (!form) return;
    if (!form.nome.trim()) return setErro("Informe o nome.");
    const r = executar((x) => salvarCategoria(x, form), form.id ? "Categoria atualizada." : "Categoria criada.");
    if (r.ok) setForm(null);
  };
  const qtdExcluindo = excluindo ? d.produtos.filter((p) => p.categoriaId === excluindo.id).length : 0;

  return (
    <>
      <PageHeader
        titulo="Categorias"
        acoes={<Button onClick={() => { setErro(undefined); setForm({ nome: "", descricao: "", ativa: true }); }}><Plus className="h-4 w-4" /> Nova categoria</Button>}
      />
      {d.categorias.length === 0 ? (
        <EmptyState icone={Tags} titulo="Nenhuma categoria" texto="Crie categorias para organizar o cardápio." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.categorias.map((c) => {
            const qtd = d.produtos.filter((p) => p.categoriaId === c.id).length;
            const Icone = iconeCategoria(c.nome);
            return (
              <article key={c.id} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                <div className="rounded-lg bg-muted p-2.5"><Icone className="h-5 w-5 text-primary" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{c.nome}</h3>
                    {!c.ativa && <Selo tom="neutro">Inativa</Selo>}
                  </div>
                  <p className="text-xs text-muted-foreground">{qtd} {qtd === 1 ? "produto" : "produtos"}{c.descricao && ` · ${c.descricao}`}</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => { setErro(undefined); setForm({ id: c.id, nome: c.nome, descricao: c.descricao ?? "", ativa: c.ativa }); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => { setDestino(""); setExcluindo(c); }}><Trash2 className="h-4 w-4" /></Button>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
          {form && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
              <Campo id="cnome" rotulo="Nome *" erro={erro}>
                <Input id="cnome" value={form.nome} maxLength={40} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </Campo>
              <Campo id="cdesc" rotulo="Descrição">
                <Input id="cdesc" value={form.descricao} maxLength={100} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </Campo>
              <div className="flex items-center gap-2">
                <Switch id="cativa" checked={form.ativa} onCheckedChange={(v) => setForm({ ...form, ativa: v })} />
                <Label htmlFor="cativa">Ativa (aparece no cardápio)</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {excluindo?.nome}?</DialogTitle>
            <DialogDescription>
              {qtdExcluindo > 0
                ? `Esta categoria possui ${qtdExcluindo} produto(s). Escolha para qual categoria eles serão movidos.`
                : "Esta categoria não possui produtos e será removida."}
            </DialogDescription>
          </DialogHeader>
          {qtdExcluindo > 0 && (
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger aria-label="Categoria de destino"><SelectValue placeholder="Mover produtos para…" /></SelectTrigger>
              <SelectContent>
                {d.categorias.filter((c) => c.id !== excluindo?.id).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={qtdExcluindo > 0 && !destino}
              onClick={() => {
                const r = executar((x) => excluirCategoria(x, excluindo!.id, destino || undefined), "Categoria excluída.");
                if (r.ok) setExcluindo(null);
              }}
            >
              {qtdExcluindo > 0 ? "Mover e excluir" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
