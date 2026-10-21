// The ONLY module that touches localStorage. Swap for API calls when a backend exists.
import type { AppData } from "./types";
import { criarDadosDemo } from "./seed";

export const STORAGE_KEY = "bebidas-mvp:dados:v1";

function valido(x: unknown): x is AppData {
  if (!x || typeof x !== "object") return false;
  const d = x as Record<string, unknown>;
  return (
    d["versao"] === 1 &&
    ["categorias", "produtos", "mesas", "sessoes", "clientes", "contas", "pedidos", "pagamentos"].every((k) =>
      Array.isArray(d[k]),
    ) &&
    typeof d["config"] === "object"
  );
}

/** Loads saved data; seeds the demo only when no valid structure exists. */
export function carregarDados(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (valido(parsed)) return parsed;
    }
  } catch {
    /* corrupted: fall through to seed */
  }
  const demo = criarDadosDemo();
  salvarDados(demo);
  return demo;
}

export function salvarDados(d: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}

export function lerDadosSalvosBrutos(raw: string | null): AppData | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return valido(p) ? p : null;
  } catch {
    return null;
  }
}
