// Central client store: one source of truth, persisted via storage.ts.
import { useSyncExternalStore } from "react";
import { useHydrated } from "@tanstack/react-router";
import { toast } from "sonner";
import type { AppData } from "./types";
import { carregarDados, lerDadosSalvosBrutos, salvarDados, STORAGE_KEY } from "./storage";
import { criarDadosDemo } from "./seed";
import { RegraError } from "./services/regras";

let estado: AppData | null = null;
const ouvintes = new Set<() => void>();
let ouvindoOutrasAbas = false;

function garantir(): AppData {
  if (!estado) estado = carregarDados();
  return estado;
}
const notificar = () => ouvintes.forEach((l) => l());

function inscrever(l: () => void) {
  ouvintes.add(l);
  if (!ouvindoOutrasAbas && typeof window !== "undefined") {
    ouvindoOutrasAbas = true;
    // Keeps other tabs of the SAME browser consistent. Not cross-device sync.
    window.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY) return;
      const novo = lerDadosSalvosBrutos(e.newValue);
      if (novo) {
        estado = novo;
        notificar();
      }
    });
  }
  return () => ouvintes.delete(l);
}

/** Returns null during SSR/hydration; the data after hydration. */
export function useDados(): AppData | null {
  const hidratado = useHydrated();
  const d = useSyncExternalStore(
    inscrever,
    () => (hidratado ? garantir() : null),
    () => null,
  );
  return hidratado ? d : null;
}

/** Runs a rule on a cloned draft and commits only on success. */
export function atualizar<T>(fn: (rascunho: AppData) => T): T {
  const rascunho = structuredClone(garantir());
  const r = fn(rascunho);
  estado = rascunho;
  salvarDados(rascunho);
  notificar();
  return r;
}

/** UI helper: runs a rule, shows a toast, returns {ok, valor}. */
export function executar<T>(fn: (d: AppData) => T, sucesso?: string): { ok: true; valor: T } | { ok: false } {
  try {
    const valor = atualizar(fn);
    if (sucesso) toast.success(sucesso);
    return { ok: true, valor };
  } catch (e) {
    toast.error(e instanceof RegraError ? e.message : "Não foi possível concluir a operação.");
    if (!(e instanceof RegraError)) console.error(e);
    return { ok: false };
  }
}

export function restaurarDemo() {
  estado = criarDadosDemo();
  salvarDados(estado);
  notificar();
}
