import { useCallback, useEffect, useState } from "react";
import { alternarTema, aplicarTema, temaAtual, type Tema } from "./tema";

/**
 * Tema no cliente. Na hidratação começa em "claro" (igual ao servidor) e sincroniza no efeito;
 * o script inicial já pintou o tema certo, então não há flash.
 */
export function useTema() {
  const [tema, setTema] = useState<Tema>("claro");

  useEffect(() => {
    setTema(temaAtual());
  }, []);

  // Reavalia a cada minuto: troca sozinho às 06:00 e 18:00 e quando uma troca manual expira.
  useEffect(() => {
    const id = setInterval(() => {
      const t = temaAtual();
      setTema(t);
      aplicarTema(t);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const alternar = useCallback(() => {
    const novo = alternarTema();
    setTema(novo);
    aplicarTema(novo);
  }, []);

  return { tema, alternar };
}
