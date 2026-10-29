import type { ResultadoAuth, ServicoAuth } from "./tipos";

const naoConfigurado = <T = void>(): ResultadoAuth<T> => ({ ok: false, codigo: "nao_configurado" });

/**
 * Implementação provisória: nenhum backend ligado. Nunca finge sucesso — toda operação falha com
 * "nao_configurado" e o painel permanece bloqueado.
 * Etapa 1B: trocar por uma implementação com Supabase Auth (Lovable Cloud) que respeite ServicoAuth.
 */
const servicoNaoConfigurado: ServicoAuth = {
  configurado: false,
  obterSessao: async () => null,
  aoMudarSessao: () => () => {},
  entrar: async () => naoConfigurado(),
  sair: async () => {},
  solicitarRecuperacao: async () => naoConfigurado(),
  linkRecuperacaoValido: async () => false,
  definirNovaSenha: async () => naoConfigurado(),
};

export const authService: ServicoAuth = servicoNaoConfigurado;
