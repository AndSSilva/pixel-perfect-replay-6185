// Contrato de autenticação do painel. A UI depende só disto; a implementação concreta
// (Lovable Cloud / Supabase Auth) entra na etapa 1B em ./servico.ts, sem mexer nas telas.

export type CodigoErroAuth =
  | "nao_configurado"
  | "credenciais_invalidas"
  | "muitas_tentativas"
  | "link_invalido"
  | "senha_fraca"
  | "sem_sessao"
  | "rede"
  | "desconhecido";

export type ResultadoAuth<T = void> =
  { ok: true; valor: T } | { ok: false; codigo: CodigoErroAuth };

export interface SessaoAdmin {
  usuarioId: string;
  email: string;
  /** Verdadeiro enquanto o administrador ainda usa a senha provisória (primeiro acesso). */
  deveTrocarSenha: boolean;
}

export interface ServicoAuth {
  /** Falso quando ainda não há backend de autenticação ligado a este ambiente. */
  readonly configurado: boolean;
  obterSessao(): Promise<SessaoAdmin | null>;
  /** Avisa mudanças de sessão (login, logout, expiração). Retorna a função de cancelar. */
  aoMudarSessao(cb: (sessao: SessaoAdmin | null) => void): () => void;
  entrar(email: string, senha: string): Promise<ResultadoAuth<SessaoAdmin>>;
  sair(): Promise<void>;
  /** Envia o e-mail de recuperação. `urlRetorno` é a página /admin/redefinir-senha. */
  solicitarRecuperacao(email: string, urlRetorno: string): Promise<ResultadoAuth>;
  /** Verdadeiro se a pessoa chegou por um link de recuperação ainda válido. */
  linkRecuperacaoValido(): Promise<boolean>;
  /**
   * Define a nova senha da sessão atual (recuperação ou primeiro acesso).
   * No primeiro acesso, a implementação também desliga o marcador `deveTrocarSenha`.
   */
  definirNovaSenha(novaSenha: string): Promise<ResultadoAuth>;
}
