// O código secreto da comanda fica só neste aparelho (localStorage), por estabelecimento e mesa.
// Quem perde o código não recupera a comanda sozinho: o atendente ajuda.
const chave = (slug: string, numero: number) => `mesa-digital:comanda:${slug}:${numero}`;

export function lerToken(slug: string, numero: number): string | null {
  try {
    const v = localStorage.getItem(chave(slug, numero));
    return v && /^[0-9a-f]{64}$/i.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function salvarToken(slug: string, numero: number, token: string): void {
  try {
    localStorage.setItem(chave(slug, numero), token);
  } catch {
    /* navegador sem armazenamento: a comanda vale só enquanto a página estiver aberta */
  }
}

export function apagarToken(slug: string, numero: number): void {
  try {
    localStorage.removeItem(chave(slug, numero));
  } catch {
    /* sem armazenamento */
  }
}
