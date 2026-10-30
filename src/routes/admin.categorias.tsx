import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Campo, EmptyState, PageHeader, Selo, iconeCategoria } from "@/components/app/common";
import { estadoDaConsulta } from "@/components/app/Consulta";
import { useEmpresa } from "@/lib/empresa/contexto";
import {
  chaveCategorias,
  chaveProdutos,
  excluirCategoria,
  listarCategorias,
  listarProdutos,
  salvarCategoria,
} from "@/lib/catalogo/servico";
import { mensagemDoErro } from "@/lib/catalogo/mensagem";
import type { Categoria } from "@/lib/catalogo/tipos";

export const Route = createFileRoute("/admin/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — Mesa Digital" },
      { name: "description", content: "Organize as categorias do cardápio." },
    ],
  }),
  component: Categorias,
});

type Form = { id?: string; nome: string; descricao: string; ativa: boolean };

function Categorias() {
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
  const [form, setForm] = useState<Form | null>(null);
  const [erro, setErro] = useState<string>();
  const [excluindo, setExcluindo] = useState<Categoria | null>(null);
  const [destino, setDestino] = useState("");

  const atualizar = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: chaveCategorias(empresa.id) }),
      qc.invalidateQueries({ queryKey: chaveProdutos(empresa.id) }),
    ]);

  const salvar = useMutation({
    mutationFn: (f: Form) => salvarCategoria(empresa.id, f),
    onSuccess: async (_d, f) => {
      await atualizar();
      toast.success(f.id ? "Categoria atualizada." : "Categoria criada.");
      setForm(null);
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });
  const excluir = useMutation({
    mutationFn: (c: { id: string; destino?: string | undefined }) =>
      excluirCategoria(empresa.id, c.id, c.destino),
    onSuccess: async () => {
      await atualizar();
      toast.success("Categoria excluída.");
      setExcluindo(null);
    },
    onError: (e) => toast.error(mensagemDoErro(e)),
  });

  const lista = categorias.data ?? [];
  const qtdPorCategoria = (id: string) =>
    (produtos.data ?? []).filter((p) => p.categoria_id === id).length;
  const qtdExcluindo = excluindo ? qtdPorCategoria(excluindo.id) : 0;
  const pronto = estadoDaConsulta(categorias) ?? estadoDaConsulta(produtos);

  const abrirNova = () => {
    setErro(undefined);
    setForm({ nome: "", descricao: "", ativa: true });
  };

  return (
    <>
      <PageHeader
        titulo="Categorias"
        acoes={
          <Button onClick={abrirNova}>
            <Plus className="h-4 w-4" /> Nova categoria
          </Button>
        }
      />
      {pronto ? (
        pronto
      ) : lista.length === 0 ? (
        <EmptyState
          icone={Tags}
          titulo="Nenhuma categoria"
          texto="Crie categorias para organizar o cardápio."
          acao={<Button onClick={abrirNova}>Nova categoria</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((c) => {
            const qtd = qtdPorCategoria(c.id);
            const Icone = iconeCategoria(c.nome);
            return (
              <article key={c.id} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                <div className="rounded-lg bg-muted p-2.5">
                  <Icone className="h-5 w-5 text-link" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium">{c.nome}</h3>
                    {!c.ativa && <Selo tom="neutro">Inativa</Selo>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {qtd} {qtd === 1 ? "produto" : "produtos"}
                    {c.descricao && ` · ${c.descricao}`}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Editar ${c.nome}`}
                  onClick={() => {
                    setErro(undefined);
                    setForm({
                      id: c.id,
                      nome: c.nome,
                      descricao: c.descricao ?? "",
                      ativa: c.ativa,
                    });
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Excluir ${c.nome}`}
                  onClick={() => {
                    setDestino("");
                    setExcluindo(c);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && !salvar.isPending && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form
              className="space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.nome.trim()) return setErro("Informe o nome.");
                setErro(undefined);
                salvar.mutate(form);
              }}
            >
              <Campo id="cnome" rotulo="Nome *" erro={erro}>
                <Input
                  id="cnome"
                  autoFocus
                  value={form.nome}
                  maxLength={60}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </Campo>
              <Campo id="cdesc" rotulo="Descrição">
                <Input
                  id="cdesc"
                  value={form.descricao}
                  maxLength={200}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </Campo>
              <div className="flex items-center gap-2">
                <Switch
                  id="cativa"
                  checked={form.ativa}
                  onCheckedChange={(v) => setForm({ ...form, ativa: v })}
                />
                <Label htmlFor="cativa">Ativa (aparece no cardápio)</Label>
              </div>
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

      <Dialog
        open={!!excluindo}
        onOpenChange={(o) => !o && !excluir.isPending && setExcluindo(null)}
      >
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
              <SelectTrigger aria-label="Categoria de destino">
                <SelectValue placeholder="Mover produtos para…" />
              </SelectTrigger>
              <SelectContent>
                {lista
                  .filter((c) => c.id !== excluindo?.id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExcluindo(null)}
              disabled={excluir.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={(qtdExcluindo > 0 && !destino) || excluir.isPending}
              onClick={() =>
                excluindo && excluir.mutate({ id: excluindo.id, destino: destino || undefined })
              }
            >
              {excluir.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {qtdExcluindo > 0 ? "Mover e excluir" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
