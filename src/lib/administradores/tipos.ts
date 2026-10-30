export type CodigoErroAdmin =
  | "sem_permissao"
  | "email_em_uso"
  | "senha_invalida"
  | "empresa_invalida"
  | "usuario_nao_encontrado"
  | "nao_e_administrador"
  | "chave_servico_ausente"
  | "dados_invalidos"
  | "desconhecido";

export type RespostaAdmin<T = void> =
  { ok: true; dados: T } | { ok: false; codigo: CodigoErroAdmin };

export const MENSAGENS_ADMIN: Record<CodigoErroAdmin, string> = {
  sem_permissao: "Você não tem permissão para esta ação.",
  email_em_uso: "Já existe um usuário com este e-mail.",
  senha_invalida: "A senha provisória não atende aos requisitos. Gere outra.",
  empresa_invalida:
    "Alguma das empresas escolhidas não existe mais. Atualize a página e tente de novo.",
  usuario_nao_encontrado: "Usuário não encontrado.",
  nao_e_administrador: "Esta ação vale só para administradores de empresa.",
  chave_servico_ausente:
    "O servidor não tem a chave de serviço configurada, então não é possível gerenciar usuários agora. Avise o suporte técnico.",
  dados_invalidos: "Dados inválidos. Confira os campos e tente novamente.",
  desconhecido: "Não foi possível concluir a operação. Tente novamente.",
};

export interface EmpresaResumo {
  id: string;
  nome: string;
  slug: string;
}

/** Administrador de empresa, como listado no painel do master. */
export interface AdministradorListado {
  usuarioId: string;
  email: string;
  deveTrocarSenha: boolean;
  criadoEm: string;
  ultimoAcesso: string | null;
  empresas: EmpresaResumo[];
}
