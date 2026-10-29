import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { authService } from "./servico";
import type { SessaoAdmin } from "./tipos";

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
  const nav = useNavigate();
  const { carregando, sessao } = useSessao();
  useEffect(() => {
    if (carregando) return;
    if (!sessao) nav({ to: "/admin/login", replace: true });
    else if (sessao.deveTrocarSenha) nav({ to: "/admin/primeiro-acesso", replace: true });
  }, [carregando, sessao, nav]);
  return { liberado: !carregando && !!sessao && !sessao.deveTrocarSenha, sessao };
}
