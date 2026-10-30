import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { listarEmpresas } from "./servico";
import type { Empresa } from "./tipos";
import type { PapelSessao } from "@/lib/auth/tipos";

/**
 * Empresa selecionável: o master acessa qualquer uma (inclusive inativas, para configurar);
 * o administrador só as ativas.
 */
export const empresasSelecionaveis = (
  papel: PapelSessao,
  empresas: readonly Empresa[],
): Empresa[] => (papel === "master" ? [...empresas] : empresas.filter((e) => e.ativo));

/**
 * Empresa em uso no painel: a salva neste navegador, se ainda for válida; ou a única
 * disponível para o administrador. Caso contrário, null (a pessoa precisa escolher).
 */
export function resolverEmpresaAtual(
  papel: PapelSessao,
  empresas: readonly Empresa[],
  salvoId: string | null,
): Empresa | null {
  const lista = empresasSelecionaveis(papel, empresas);
  const salva = salvoId ? lista.find((e) => e.id === salvoId) : undefined;
  if (salva) return salva;
  if (papel === "admin" && lista.length === 1) return lista[0] ?? null;
  return null;
}

// ---- Escolha salva neste navegador (por usuário), observável pelos componentes ----
const chave = (usuarioId: string) => `mesa-digital:empresa:${usuarioId}`;
const ouvintes = new Set<() => void>();

function lerSalva(usuarioId: string): string | null {
  try {
    return localStorage.getItem(chave(usuarioId));
  } catch {
    return null;
  }
}

export function salvarEmpresaEscolhida(usuarioId: string, empresaId: string | null) {
  try {
    if (empresaId) localStorage.setItem(chave(usuarioId), empresaId);
    else localStorage.removeItem(chave(usuarioId));
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
  ouvintes.forEach((l) => l());
}

function useEmpresaSalva(usuarioId: string): string | null {
  return useSyncExternalStore(
    (cb) => {
      ouvintes.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        ouvintes.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => lerSalva(usuarioId),
    () => null,
  );
}

export const CHAVE_EMPRESAS = ["empresas"] as const;

/** Empresas acessíveis + empresa em uso. `usuarioId`/`papel` vêm da sessão. */
export function useEmpresaAtual(usuarioId: string, papel: PapelSessao) {
  const consulta = useQuery({ queryKey: [...CHAVE_EMPRESAS, usuarioId], queryFn: listarEmpresas });
  const salvaId = useEmpresaSalva(usuarioId);
  const todas = consulta.data ?? [];
  const atual = resolverEmpresaAtual(papel, todas, salvaId);
  const empresas = empresasSelecionaveis(papel, todas);

  // Administrador com uma só empresa: grava a escolha automática (evita piscar o seletor).
  useEffect(() => {
    if (atual && atual.id !== salvaId) salvarEmpresaEscolhida(usuarioId, atual.id);
  }, [atual, salvaId, usuarioId]);

  const escolher = useCallback((id: string) => salvarEmpresaEscolhida(usuarioId, id), [usuarioId]);
  const limpar = useCallback(() => salvarEmpresaEscolhida(usuarioId, null), [usuarioId]);

  return {
    carregando: consulta.isPending,
    erro: consulta.isError,
    recarregar: consulta.refetch,
    empresas,
    atual,
    escolher,
    limpar,
  };
}
