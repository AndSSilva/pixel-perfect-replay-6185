import type { AuthError, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { buscarPerfilAcesso, marcarSenhaTrocada } from "./perfil-acesso";
import type { CodigoErroAuth, ResultadoAuth, ServicoAuth, SessaoAdmin } from "./tipos";

/** Converte um erro do Supabase Auth em um código nosso (sem expor detalhes ao usuário). */
export function codigoDoErro(
  erro: Pick<AuthError, "message"> & Partial<AuthError>,
): CodigoErroAuth {
  const codigo = erro.code ?? "";
  const status = erro.status ?? 0;
  if (codigo === "invalid_credentials" || /invalid login credentials/i.test(erro.message))
    return "credenciais_invalidas";
  if (
    status === 429 ||
    codigo === "over_request_rate_limit" ||
    codigo === "over_email_send_rate_limit"
  )
    return "muitas_tentativas";
  if (codigo === "weak_password") return "senha_fraca";
  if (codigo === "same_password") return "senha_repetida";
  if (
    codigo === "otp_expired" ||
    codigo === "flow_state_not_found" ||
    codigo === "flow_state_expired"
  )
    return "link_invalido";
  if (codigo === "session_not_found" || codigo === "refresh_token_not_found") return "sem_sessao";
  if (
    erro.name === "AuthRetryableFetchError" ||
    status === 0 ||
    /failed to fetch|network/i.test(erro.message)
  )
    return "rede";
  return "desconhecido";
}

// O link do e-mail de recuperação chega com "#...type=recovery" (ou o evento PASSWORD_RECOVERY).
// O hash é lido na carga do módulo, antes de o cliente do Supabase limpá-lo da URL.
let recuperacaoDetectada =
  typeof window !== "undefined" && /[#&]type=recovery\b/.test(window.location.hash);
let ouvindoRecuperacao = false;

function ouvirRecuperacao() {
  if (ouvindoRecuperacao || typeof window === "undefined") return;
  ouvindoRecuperacao = true;
  supabase.auth.onAuthStateChange((evento) => {
    if (evento === "PASSWORD_RECOVERY") recuperacaoDetectada = true;
  });
}

/** Sessão do painel: só existe para quem tem papel "admin" na tabela de perfis. */
async function sessaoAdminDe(sessao: Session | null): Promise<SessaoAdmin | null> {
  if (!sessao) return null;
  const perfil = await buscarPerfilAcesso(sessao.user.id);
  if (!perfil || perfil.papel !== "admin") return null;
  return {
    usuarioId: sessao.user.id,
    email: sessao.user.email ?? "",
    deveTrocarSenha: perfil.deve_trocar_senha,
  };
}

const falha = (codigo: CodigoErroAuth): { ok: false; codigo: CodigoErroAuth } => ({
  ok: false,
  codigo,
});

export function criarServicoSupabase(): ServicoAuth {
  return {
    async obterSessao() {
      ouvirRecuperacao();
      const { data, error } = await supabase.auth.getSession();
      if (error) return null;
      try {
        return await sessaoAdminDe(data.session);
      } catch {
        return null; // sem conseguir confirmar o papel, não libera o painel
      }
    },

    aoMudarSessao(cb) {
      ouvirRecuperacao();
      const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
        if (evento === "INITIAL_SESSION") return; // a leitura inicial é feita por obterSessao()
        // Não fazer chamadas ao Supabase dentro do callback (risco de travar); adia para fora dele.
        setTimeout(() => {
          sessaoAdminDe(sessao)
            .catch(() => null)
            .then(cb);
        }, 0);
      });
      return () => data.subscription.unsubscribe();
    },

    async entrar(email, senha): Promise<ResultadoAuth<SessaoAdmin>> {
      ouvirRecuperacao();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) return falha(codigoDoErro(error));
      try {
        const sessao = await sessaoAdminDe(data.session);
        if (!sessao) {
          await supabase.auth.signOut();
          return falha("sem_permissao");
        }
        return { ok: true, valor: sessao };
      } catch {
        await supabase.auth.signOut();
        return falha("desconhecido");
      }
    },

    async sair() {
      recuperacaoDetectada = false;
      await supabase.auth.signOut();
    },

    async solicitarRecuperacao(email, urlRetorno): Promise<ResultadoAuth> {
      ouvirRecuperacao();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: urlRetorno,
      });
      // O Supabase não revela se o e-mail existe; só falhas gerais chegam como erro.
      if (error) return falha(codigoDoErro(error));
      return { ok: true, valor: undefined };
    },

    async linkRecuperacaoValido() {
      ouvirRecuperacao();
      // getSession() aguarda a leitura do link na URL, que dispara PASSWORD_RECOVERY.
      const { data, error } = await supabase.auth.getSession();
      return !error && !!data.session && recuperacaoDetectada;
    },

    async definirNovaSenha(novaSenha): Promise<ResultadoAuth> {
      ouvirRecuperacao();
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) return falha(codigoDoErro(error));
      try {
        // Desliga o marcador do primeiro acesso (sem efeito se não havia marcador pendente).
        await marcarSenhaTrocada();
      } catch {
        return falha("desconhecido");
      }
      recuperacaoDetectada = false;
      return { ok: true, valor: undefined };
    },
  };
}
