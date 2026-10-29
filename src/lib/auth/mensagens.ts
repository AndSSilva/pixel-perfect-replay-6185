import type { CodigoErroAuth } from "./tipos";

// Mensagens deliberadamente genéricas: não revelam se um e-mail existe ou qual dado errou.
export const MENSAGENS_AUTH: Record<CodigoErroAuth, string> = {
  credenciais_invalidas: "E-mail ou senha incorretos.",
  muitas_tentativas: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  link_invalido: "Este link é inválido ou expirou. Solicite um novo.",
  senha_fraca: "Esta senha não atende aos requisitos de segurança. Escolha outra.",
  senha_repetida: "A nova senha deve ser diferente da senha atual.",
  falha_marcador:
    "Sua senha foi alterada, mas não foi possível concluir o primeiro acesso. Clique em salvar novamente (você pode repetir a mesma senha).",
  sem_permissao: "Seu usuário não tem acesso ao painel administrativo.",
  sem_sessao: "Sua sessão expirou. Entre novamente.",
  rede: "Não foi possível conectar. Verifique sua internet e tente novamente.",
  desconhecido: "Não foi possível concluir a operação. Tente novamente.",
};

export const mensagemAuth = (c: CodigoErroAuth) => MENSAGENS_AUTH[c];
