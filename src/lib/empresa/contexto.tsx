import { createContext, useContext, type ReactNode } from "react";
import type { Empresa } from "./tipos";

// Empresa em uso no painel (/admin). Quem fornece é o layout, depois de a pessoa escolher a empresa.
const Contexto = createContext<Empresa | null>(null);

export function EmpresaProvider({ empresa, children }: { empresa: Empresa; children: ReactNode }) {
  return <Contexto.Provider value={empresa}>{children}</Contexto.Provider>;
}

/** Empresa em uso. Só pode ser chamado dentro das páginas do painel (que já têm empresa escolhida). */
export function useEmpresa(): Empresa {
  const e = useContext(Contexto);
  if (!e) throw new Error("useEmpresa fora do painel de uma empresa");
  return e;
}
