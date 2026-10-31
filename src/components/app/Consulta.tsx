import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Carregando, EmptyState } from "@/components/app/common";

/**
 * Estado de uma consulta que ainda não tem dados: carregando ou erro com "tentar novamente".
 * Devolve `null` quando já há dados para mostrar.
 */
export function estadoDaConsulta(q: {
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
}): ReactNode | null {
  if (q.isPending) return <Carregando />;
  if (q.isError) {
    return (
      <EmptyState
        icone={TriangleAlert}
        titulo="Não foi possível carregar"
        texto="Verifique sua conexão e tente novamente."
        acao={<Button onClick={() => void q.refetch()}>Tentar novamente</Button>}
      />
    );
  }
  return null;
}
