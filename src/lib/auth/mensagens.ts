import type { CodigoErroAuth } from "./tipos";

// Mensagens deliberadamente genéricas: não revelam se um e-mail existe ou qual dado errou.
export const MENSAGENS_AUTH: Record<CodigoErroAuth, string> = {
  nao_configurado: "A autenticação ainda não foi configurada neste ambiente.",
  credenciais_invalidas: "E-mail ou senha incorretos.",
  muitas_tentativas: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  link_invalido: "Este link é inválido ou expirou. Solicite um novo.",
  senha_fraca: "Esta senha não atende aos requisitos de segurança. Escolha outra.",
  sem_sessao: "Sua sessão expirou. Entre novamente.",
  rede: "Não foi possível conectar. Verifique sua internet e tente novamente.",
  desconhecido: "Não foi possível concluir a operação. Tente novamente.",
};

export const mensagemAuth = (c: CodigoErroAuth) => MENSAGENS_AUTH[c];
