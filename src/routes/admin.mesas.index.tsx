import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Armchair, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Campo, Confirmar, EmptyState, PageHeader, Selo, seloMesa } from "@/components/app/common";
import { executar, useDados } from "@/lib/store";
import { contasDaSessao, excluirMesa, salvarMesa, statusMesa, totalConfirmadoConta } from "@/lib/services/regras";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/mesas/")({
  head: () => ({
    meta: [
      { title: "Mesas — Gestão de Bebidas" },
      { name: "description", content: "Ocupação das mesas, QR Codes e atendimento." },
      { property: "og:title", content: "Mesas — Gestão de Bebidas" },
      { property: "og:description", content: "Ocupação das mesas, QR Codes e atendimento." },
    ],
  }),
  component: Mesas,
});

const borda = { disponivel: "", ocupada: "border-primary/50", aguardando: "border-warning/60 bg-warning/5", inativa: "opacity-60" };

function Mesas() {
  const d = useDados()!;
  const [form, setForm] = useState<{ id?: string; nome: string; ativa: boolean } | null>(null);
  const [erro, setErro] = useState<string>();

  const salvar = () => {
    if (!form) return;
    if (!form.nome.trim()) return setErro("Informe o nome ou número.");
    const r = executar((x) => salvarMesa(x, form), form.id ? "Mesa atualizada." : "Mesa criada.");
    if (r.ok) setForm(null);
  };

  return (
    <>
      <PageHeader
        titulo="Mesas"
        descricao="Toque em uma mesa para ver contas, pedidos e QR Code."
        acoes={<Button onClick={() => { setErro(undefined); setForm({ nome: `Mesa ${String(d.mesas.length + 1).padStart(2, "0")}`, ativa: true }); }}><Plus className="h-4 w-4" /> Nova mesa</Button>}
      />
      {d.mesas.length === 0 ? (
        <EmptyState icone={Armchair} titulo="Nenhuma mesa cadastrada" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.mesas.map((m) => {
            const st = statusMesa(d, m);
            const [tom, rot] = seloMesa[st];
            const contas = m.sessaoAtualId ? contasDaSessao(d, m.sessaoAtualId) : [];
            const total = contas.reduce((s, c) => s + totalConfirmadoConta(d, c.id), 0);
            return (
              <article key={m.id} className={cn("rounded-xl border bg-card p-4 transition-colors", borda[st])}>
                <div className="flex items-start justify-between gap-2">
                  <Link to="/admin/mesas/$mesaId" params={{ mesaId: m.id }} className="font-display text-xl font-semibold hover:text-primary">
                    {m.nome}
                  </Link>
                  <Selo tom={tom}>{rot}</Selo>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" /> {contas.length} {contas.length === 1 ? "cliente" : "clientes"}
                  {contas.length > 0 && <> · <span className="tabular text-foreground">{formatBRL(total)}</span></>}
                </p>
                <div className="mt-4 flex items-center gap-1">
                  <Button asChild size="sm" variant="secondary" className="flex-1">
                    <Link to="/admin/mesas/$mesaId" params={{ mesaId: m.id }}>Abrir detalhes</Link>
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Editar mesa" onClick={() => { setErro(undefined); setForm({ id: m.id, nome: m.nome, ativa: m.ativa }); }}><Pencil className="h-4 w-4" /></Button>
                  <Confirmar
                    gatilho={<Button size="icon" variant="ghost" aria-label="Excluir mesa"><Trash2 className="h-4 w-4" /></Button>}
                    titulo={`Excluir ${m.nome}?`}
                    descricao="Mesas com atendimento, pedidos ou contas em aberto não podem ser excluídas."
                    rotuloAcao="Excluir"
                    perigo
                    onConfirmar={() => executar((x) => excluirMesa(x, m.id), "Mesa excluída.")}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar mesa" : "Nova mesa"}</DialogTitle></DialogHeader>
          {form && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
              <Campo id="mnome" rotulo="Nome ou número *" erro={erro}>
                <Input id="mnome" value={form.nome} maxLength={30} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </Campo>
              <div className="flex items-center gap-2">
                <Switch id="mativa" checked={form.ativa} onCheckedChange={(v) => setForm({ ...form, ativa: v })} />
                <Label htmlFor="mativa">Mesa ativa</Label>
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
