import { useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEmpresa } from "@/lib/empresa/contexto";
import {
  CHAVE_LARGURA,
  cupomPedidoHtml,
  imprimirHtml,
  lerLargura,
  notaContaHtml,
  salvarLargura,
  type LarguraCupom,
} from "@/lib/impressao/cupom";
import type { ComandaPainel } from "@/lib/pedidos/contas";
import type { PedidoPainel } from "@/lib/pedidos/painel";
import { listarComposicaoItens } from "@/lib/pedidos/servico-painel";

type EmpresaImpressao = { id: string; nome: string; endereco: string | null };

export async function imprimirPedido(empresa: EmpresaImpressao, pedido: PedidoPainel) {
  const composicao = await listarComposicaoItens(
    empresa.id,
    pedido.itens.map((i) => i.id),
  );
  imprimirHtml(cupomPedidoHtml(empresa, pedido, composicao, lerLargura()));
}

export async function imprimirNotaDaConta(empresa: EmpresaImpressao, conta: ComandaPainel) {
  const ids = conta.pedidos.flatMap((p) => p.itens.map((i) => i.id));
  const composicao = await listarComposicaoItens(empresa.id, ids);
  imprimirHtml(notaContaHtml(empresa, conta, composicao, lerLargura()));
}

/** Imprime o cupom do pedido confirmado (cozinha/bar). Vale para qualquer pedido confirmado. */
export function ImprimirCupomPedido({ pedido }: { pedido: PedidoPainel }) {
  const empresa = useEmpresa();
  const [ocupado, setOcupado] = useState(false);
  const imprimir = async () => {
    setOcupado(true);
    try {
      await imprimirPedido(empresa, pedido);
    } catch {
      toast.error("Não foi possível preparar o cupom.");
    } finally {
      setOcupado(false);
    }
  };
  return (
    <Button size="sm" variant="outline" disabled={ocupado} onClick={() => void imprimir()}>
      <Printer className="h-4 w-4" /> Imprimir cupom
    </Button>
  );
}

/** Imprime a nota (recibo não fiscal) da conta. */
export function ImprimirNota({ conta, className }: { conta: ComandaPainel; className?: string }) {
  const empresa = useEmpresa();
  const [ocupado, setOcupado] = useState(false);
  const imprimir = async () => {
    setOcupado(true);
    try {
      await imprimirNotaDaConta(empresa, conta);
    } catch {
      toast.error("Não foi possível preparar a nota.");
    } finally {
      setOcupado(false);
    }
  };
  return (
    <Button
      variant="outline"
      className={className}
      disabled={ocupado}
      onClick={() => void imprimir()}
    >
      <Printer className="h-4 w-4" /> Imprimir nota
    </Button>
  );
}

/** Escolha da largura da bobina deste aparelho (58 ou 80 mm). */
export function LarguraDoCupom() {
  const [largura, setLargura] = useState<LarguraCupom>(() => lerLargura());
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Largura da bobina da impressora térmica deste aparelho. A escolha fica salva só neste
        navegador ({CHAVE_LARGURA}).
      </p>
      <div className="flex gap-2" role="radiogroup" aria-label="Largura da bobina">
        {([58, 80] as const).map((l) => (
          <Button
            key={l}
            type="button"
            role="radio"
            aria-checked={largura === l}
            variant={largura === l ? "default" : "outline"}
            onClick={() => {
              salvarLargura(l);
              setLargura(l);
            }}
          >
            {l} mm
          </Button>
        ))}
      </div>
    </div>
  );
}
