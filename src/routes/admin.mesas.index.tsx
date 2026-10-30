import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Armchair, Loader2, Plus, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Campo, Confirmar, EmptyState, PageHeader, Selo } from "@/components/app/common";
import { estadoDaConsulta } from "@/components/app/Consulta";
import { useEmpresa } from "@/lib/empresa/contexto";
import {
  chaveMesas,
  criarMesas,
  definirMesaAtiva,
  excluirMesa,
  listarMesas,
} from "@/lib/catalogo/servico";
import { mensagemDoErro } from "@/lib/catalogo/mensagem";
import {
  MAX_MESAS_POR_VEZ,
  NUMERO_MESA_MAX,
  caminhoMesa,
  numerosParaCriar,
  proximoNumeroMesa,
  rotuloMesa,
} from "@/lib/catalogo/mesas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/mesas/")({
  head: () => ({
    meta: [
      { title: "Mesas — Mesa Digital" },
      { name: "description", content: "Mesas da empresa e QR Codes do cardápio." },
    ],
  }),
  component: Mesas,
});

const inteiro = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN);

function Mesas() {
  const empresa = useEmpresa();
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: chaveMesas(empresa.id),
    queryFn: () => listarMesas(empresa.id),
  });
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState("1");
  const [quantidade, setQuantidade] = useState("1");
  const [erro, setErro] = useState<string>();

  const mesas = consulta.data ?? [];
  const usados = mesas.map((m) => m.numero);
  const atualizar = () => qc.invalidateQueries({ queryKey: chaveMesas(empresa.id) });

  const criar = useMutation({
    mutationFn: (numeros: number[]) => criarMesas(empresa.id, numeros),
    onSuccess: async (_d, numeros) => {
      await atualizar();
      toast.success(numeros.length === 1 ? "Mesa criada." : `${numeros.length} mesas criadas.`);
      setAberto(false);
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });
  const alternar = useMutation({
    mutationFn: (v: { id: string; ativa: boolean }) => definirMesaAtiva(empresa.id, v.id, v.ativa),
    onSuccess: atualizar,
    onError: (e) => toast.error(mensagemDoErro(e)),
  });
  const excluir = useMutation({
    mutationFn: (id: string) => excluirMesa(empresa.id, id),
    onSuccess: async () => {
      await atualizar();
      toast.success("Mesa excluída.");
    },
    onError: (e) => toast.error(mensagemDoErro(e)),
  });

  const n0 = inteiro(inicio);
  const qtd = inteiro(quantidade);
  const valido = n0 >= 1 && n0 <= NUMERO_MESA_MAX && qtd >= 1 && qtd <= MAX_MESAS_POR_VEZ;
  const previa = valido ? numerosParaCriar(n0, qtd, usados) : [];

  const abrir = () => {
    setErro(undefined);
    setInicio(String(proximoNumeroMesa(usados)));
    setQuantidade("1");
    setAberto(true);
  };

  const pronto = estadoDaConsulta(consulta);
  return (
    <>
      <PageHeader
        titulo="Mesas"
        descricao="Cada mesa tem um QR Code que abre o cardápio da empresa."
        acoes={
          <Button onClick={abrir}>
            <Plus className="h-4 w-4" /> Nova mesa
          </Button>
        }
      />
      {pronto ? (
        pronto
      ) : mesas.length === 0 ? (
        <EmptyState
          icone={Armchair}
          titulo="Nenhuma mesa cadastrada"
          texto="Crie as mesas informando o número delas."
          acao={<Button onClick={abrir}>Nova mesa</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mesas.map((m) => (
            <article
              key={m.id}
              className={cn(
                "rounded-xl border bg-card p-4 transition-colors",
                !m.ativa && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-xl font-semibold">{rotuloMesa(m.numero)}</h3>
                <Selo tom={m.ativa ? "sucesso" : "neutro"}>{m.ativa ? "Ativa" : "Desativada"}</Selo>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {caminhoMesa(empresa.slug, m.numero)}
              </p>
              <div className="mt-4 flex items-center gap-1">
                <Button asChild size="sm" variant="secondary" className="flex-1">
                  <Link to="/admin/imprimir/$mesaId" params={{ mesaId: m.id }}>
                    <QrCode className="h-4 w-4" aria-hidden /> QR Code
                  </Link>
                </Button>
                <Switch
                  checked={m.ativa}
                  disabled={alternar.isPending}
                  onCheckedChange={(v) => alternar.mutate({ id: m.id, ativa: v })}
                  aria-label={`${m.ativa ? "Desativar" : "Ativar"} ${rotuloMesa(m.numero)}`}
                  className="mx-2"
                />
                <Confirmar
                  gatilho={
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Excluir ${rotuloMesa(m.numero)}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                  titulo={`Excluir ${rotuloMesa(m.numero)}?`}
                  descricao="O QR Code desta mesa deixa de funcionar. Mesas com pedidos ou contas não poderão ser excluídas."
                  rotuloAcao="Excluir"
                  perigo
                  onConfirmar={() => excluir.mutate(m.id)}
                />
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={aberto} onOpenChange={(o) => !o && !criar.isPending && setAberto(false)}>
        <DialogContent>
          <form
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!valido)
                return setErro(
                  `Use um número de 1 a ${NUMERO_MESA_MAX} e de 1 a ${MAX_MESAS_POR_VEZ} mesas por vez.`,
                );
              if (previa.length === 0) return setErro("Esses números já estão em uso.");
              setErro(undefined);
              criar.mutate(previa);
            }}
          >
            <DialogHeader>
              <DialogTitle>Nova mesa</DialogTitle>
              <DialogDescription>
                A mesa é identificada pelo número. O número não pode ser alterado depois, porque faz
                parte do endereço do QR Code.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="minicio" rotulo="Número da mesa *">
                <Input
                  id="minicio"
                  autoFocus
                  inputMode="numeric"
                  value={inicio}
                  maxLength={4}
                  onChange={(e) => setInicio(e.target.value)}
                />
              </Campo>
              <Campo id="mqtd" rotulo="Quantas mesas" dica="Para criar várias em sequência.">
                <Input
                  id="mqtd"
                  inputMode="numeric"
                  value={quantidade}
                  maxLength={2}
                  onChange={(e) => setQuantidade(e.target.value)}
                />
              </Campo>
            </div>
            {previa.length > 0 && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                Serão criadas:{" "}
                <span className="font-medium text-foreground">
                  {previa.length <= 6
                    ? previa.map(rotuloMesa).join(", ")
                    : `${rotuloMesa(previa[0]!)} até ${rotuloMesa(previa[previa.length - 1]!)} (${previa.length} mesas)`}
                </span>
              </p>
            )}
            {erro && (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {erro}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAberto(false)}
                disabled={criar.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={criar.isPending}>
                {criar.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
