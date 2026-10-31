import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Campo, EmptyState, Selo } from "@/components/app/common";
import { estadoDaConsulta } from "@/components/app/Consulta";
import {
  AJUDA_AJUSTE,
  ROTULO_MOVIMENTO,
  validarAjuste,
  type TipoAjuste,
} from "@/lib/catalogo/estoque";
import { mensagemDoErro } from "@/lib/catalogo/mensagem";
import {
  ajustarEstoque,
  chaveMovimentos,
  chaveProdutos,
  listarMovimentos,
} from "@/lib/catalogo/servico";
import type { Produto } from "@/lib/catalogo/tipos";
import { formatDataHora } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Ajuste de estoque (com tipo e motivo) e histórico de movimentos de um produto. */
export function EstoqueDialog({
  produto,
  empresaId,
  onFechar,
}: {
  produto: Produto | null;
  empresaId: string;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const historico = useQuery({
    queryKey: chaveMovimentos(produto?.id ?? ""),
    queryFn: () => listarMovimentos(produto!.id),
    enabled: !!produto,
  });
  const temHistorico = (historico.data?.length ?? 0) > 0;
  const [tipo, setTipo] = useState<TipoAjuste>("reposicao");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string>();

  useEffect(() => {
    if (produto) {
      setTipo("reposicao");
      setQuantidade("");
      setObservacao("");
      setErro(undefined);
    }
  }, [produto]);

  const ajuste = useMutation({
    mutationFn: () =>
      ajustarEstoque({ produtoId: produto!.id, tipo, quantidade: Number(quantidade), observacao }),
    onSuccess: async (saldo) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: chaveProdutos(empresaId) }),
        qc.invalidateQueries({ queryKey: chaveMovimentos(produto!.id) }),
      ]);
      toast.success(`Estoque atualizado: ${saldo} un.`);
      setQuantidade("");
      setObservacao("");
      setErro(undefined);
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });

  const ajuda = AJUDA_AJUSTE[tipo];
  const previa = validarAjuste({
    tipo,
    quantidade,
    observacao,
    estoqueAtual: produto?.estoque_qtd ?? 0,
    temHistorico,
  });
  const tipos: TipoAjuste[] = [
    "saldo_inicial",
    "reposicao",
    "alteracao_quantidade",
    "baixa_avaria",
  ];

  return (
    <Dialog open={!!produto} onOpenChange={(o) => !o && !ajuste.isPending && onFechar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estoque: {produto?.nome}</DialogTitle>
          <DialogDescription>
            Estoque atual:{" "}
            <span className="font-semibold text-foreground">{produto?.estoque_qtd} un.</span> O
            estoque só muda por lançamentos registrados no histórico (e pelas entregas dos pedidos).
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="ajustar">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ajustar">Ajustar</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="ajustar">
            <form
              className="mt-3 space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (previa.erro) return setErro(previa.erro);
                setErro(undefined);
                ajuste.mutate();
              }}
            >
              <Campo id="est-tipo" rotulo="Tipo de lançamento">
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAjuste)}>
                  <SelectTrigger id="est-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => (
                      <SelectItem
                        key={t}
                        value={t}
                        disabled={t === "saldo_inicial" && temHistorico}
                      >
                        {ROTULO_MOVIMENTO[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo id="est-qtd" rotulo={ajuda.campo} dica={ajuda.dica}>
                <Input
                  id="est-qtd"
                  inputMode="numeric"
                  maxLength={7}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                />
              </Campo>
              <Campo id="est-obs" rotulo={ajuda.observacaoObrigatoria ? "Motivo *" : "Observação"}>
                <Textarea
                  id="est-obs"
                  maxLength={200}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </Campo>
              {previa.novoSaldo !== null && (
                <p className="rounded-md bg-muted px-3 py-2 text-sm">
                  Estoque depois do lançamento:{" "}
                  <span className="font-semibold">{previa.novoSaldo} un.</span>
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
                  onClick={onFechar}
                  disabled={ajuste.isPending}
                >
                  Fechar
                </Button>
                <Button type="submit" disabled={ajuste.isPending}>
                  {ajuste.isPending && <Loader2 className="animate-spin" aria-hidden />}
                  Lançar
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
          <TabsContent value="historico">
            <div className="mt-3">
              {estadoDaConsulta(historico) ??
                ((historico.data ?? []).length === 0 ? (
                  <EmptyState
                    icone={Loader2}
                    titulo="Sem lançamentos"
                    texto="Os lançamentos de estoque aparecem aqui."
                  />
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {(historico.data ?? []).map((m) => (
                      <li
                        key={m.id}
                        className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{ROTULO_MOVIMENTO[m.tipo]}</p>
                          {m.observacao && (
                            <p className="break-words text-xs text-muted-foreground">
                              {m.observacao}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatDataHora(m.criado_em)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <Selo tom={m.variacao >= 0 ? "sucesso" : "alerta"}>
                            <span className={cn("tabular")}>
                              {m.variacao > 0 ? "+" : ""}
                              {m.variacao}
                            </span>
                          </Selo>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            saldo {m.saldo_apos}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
