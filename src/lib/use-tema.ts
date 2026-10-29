import { useCallback, useEffect, useState } from "react";
import {
  aplicarTema,
  lerPreferencia,
  resolverTema,
  salvarPreferencia,
  type PreferenciaTema,
  type Tema,
} from "./tema";

/**
 * Estado do tema no cliente. Na hidratação assume "automatico"/"claro" (igual ao servidor) e
 * sincroniza no efeito; o script inicial já pintou o tema certo, então não há flash.
 */
export function useTema() {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>("automatico");
  const [tema, setTema] = useState<Tema>("claro");

  useEffect(() => {
    const p = lerPreferencia();
    setPreferencia(p);
    setTema(resolverTema(p));
  }, []);

  // No modo automático, reavalia a cada minuto (troca às 06:00 e às 18:00).
  useEffect(() => {
    if (preferencia !== "automatico") return;
    const id = setInterval(() => {
      const t = resolverTema("automatico");
      setTema(t);
      aplicarTema(t);
    }, 60_000);
    return () => clearInterval(id);
  }, [preferencia]);

  const escolher = useCallback((p: PreferenciaTema) => {
    salvarPreferencia(p);
    const t = resolverTema(p);
    setPreferencia(p);
    setTema(t);
    aplicarTema(t);
  }, []);

  return { tema, preferencia, escolher };
}
