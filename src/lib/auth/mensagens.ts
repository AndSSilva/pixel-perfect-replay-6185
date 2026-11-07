import type { CodigoErroAuth } from "./tipos";

// Mensagens deliberadamente genéricas: não revelam se um e-mail existe ou qual dado errou.
export const MENSAGENS_AUTH: Record<CodigoErroAuth, string> = {
  credenciais_invalidas: "E-mail ou senha incorretos.",
  muitas_tentativas: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  link_invalido: "Este link é inválido ou expirou. Solicite um novo.",
  senha_fraca:
    "O servidor recusou esta senha por ser fraca. Use 10 ou mais caracteres, misturando letras maiúsculas e minúsculas, números e símbolos, e evite sequências ou palavras comuns.",
  senha_vazada:
    "Esta senha aparece em vazamentos de dados conhecidos e não pode ser usada. Escolha uma senha única, que você não use em outros lugares.",
  senha_repetida: "A nova senha deve ser diferente da senha atual.",
  falha_marcador:
    "Sua senha foi alterada, mas não foi possível concluir o primeiro acesso. Clique em salvar novamente (você pode repetir a mesma senha).",
  senha_atual_incorreta: "A senha atual (provisória) está incorreta.",
  senha_atual_exigida:
    "Para trocar a senha é preciso informar a senha atual. Use o primeiro acesso ou peça ajuda ao administrador da plataforma.",
  sem_permissao: "Seu usuário não tem acesso ao painel administrativo.",
  sem_sessao: "Sua sessão expirou. Entre novamente.",
  rede: "Não foi possível conectar. Verifique sua internet e tente novamente.",
  desconhecido: "Não foi possível concluir a operação. Tente novamente.",
};

export const mensagemAuth = (c: CodigoErroAuth) => MENSAGENS_AUTH[c];
