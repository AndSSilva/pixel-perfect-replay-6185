import { ErroCatalogo, MENSAGENS_CATALOGO } from "./tipos";

/** Texto para mostrar ao usuário (toast) a partir de qualquer erro de uma operação do catálogo. */
export const mensagemDoErro = (e: unknown): string =>
  e instanceof ErroCatalogo ? e.message : MENSAGENS_CATALOGO.desconhecido;
