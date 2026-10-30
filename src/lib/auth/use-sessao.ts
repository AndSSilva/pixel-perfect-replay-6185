import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { authService } from "./servico";
import type { PapelSessao, SessaoAdmin } from "./tipos";

export interface EstadoSessao {
  carregando: boolean;
  sessao: SessaoAdmin | null;
}

/** Sessão atual do administrador; `carregando` é verdadeiro até a primeira leitura. */
export function useSessao(): EstadoSessao {
  const [estado, setEstado] = useState<EstadoSessao>({ carregando: true, sessao: null });
  useEffect(() => {
    let ativo = true;
    authService
      .obterSessao()
      .then((sessao) => ativo && setEstado({ carregando: false, sessao }))
      .catch(() => ativo && setEstado({ carregando: false, sessao: null }));
    const cancelar = authService.aoMudarSessao(
      (sessao) => ativo && setEstado({ carregando: false, sessao }),
    );
    return () => {
      ativo = false;
      cancelar();
    };
  }, []);
  return estado;
}

/**
 * Guarda das páginas do painel: sem sessão → login; com senha provisória → primeiro acesso.
 * Devolve `liberado` apenas quando é seguro renderizar o conteúdo.
 * Obs.: é uma barreira de interface. A proteção real dos dados vem das regras de acesso do banco (etapa 1B).
 */
export function useGuardaAdmin(): { liberado: boolean; sessao: SessaoAdmin | null } {
  return useGuarda(["admin", "master"]);
}

/** Guarda do painel da plataforma: só o master. Administrador comum volta ao seu painel. */
export function useGuardaMaster(): { liberado: boolean; sessao: SessaoAdmin | null } {
  return useGuarda(["master"]);
}

/** Para onde a pessoa vai logo depois de entrar. */
export const destinoInicial = (s: Pick<SessaoAdmin, "papel" | "deveTrocarSenha">) =>
  s.deveTrocarSenha ? "/admin/primeiro-acesso" : s.papel === "master" ? "/master" : "/admin";

function useGuarda(permitidos: readonly PapelSessao[]): {
  liberado: boolean;
  sessao: SessaoAdmin | null;
} {
  const nav = useNavigate();
  const { carregando, sessao } = useSessao();
  const permitido = !!sessao && permitidos.includes(sessao.papel);
  useEffect(() => {
    if (carregando) return;
    if (!sessao) nav({ to: "/admin/login", replace: true });
    else if (sessao.deveTrocarSenha) nav({ to: "/admin/primeiro-acesso", replace: true });
    else if (!permitido) nav({ to: destinoInicial(sessao), replace: true });
  }, [carregando, sessao, permitido, nav]);
  return { liberado: !carregando && !!sessao && !sessao.deveTrocarSenha && permitido, sessao };
}
