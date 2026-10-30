// Redimensiona uma foto (câmera ou upload) para um data URL JPEG leve,
// adequado ao armazenamento local do navegador.
const LADO_MAX = 640;
const QUALIDADE = 0.8;
export const TAMANHO_MAX_ARQUIVO = 8 * 1024 * 1024; // 8 MB de entrada

export function arquivoParaDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    if (!arquivo.type.startsWith("image/")) {
      rejeitar(new Error("Escolha um arquivo de imagem."));
      return;
    }
    if (arquivo.size > TAMANHO_MAX_ARQUIVO) {
      rejeitar(new Error("A imagem é muito grande (máx. 8 MB)."));
      return;
    }
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * escala));
      const h = Math.max(1, Math.round(img.height * escala));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rejeitar(new Error("Não foi possível processar a imagem."));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolver(canvas.toDataURL("image/jpeg", QUALIDADE));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rejeitar(new Error("Não foi possível ler esta imagem."));
    };
    img.src = url;
  });
}

/** Converte o data URL (já reduzido por arquivoParaDataUrl) em Blob JPEG para envio ao armazenamento. */
export async function dataUrlParaBlob(dataUrl: string): Promise<Blob> {
  const r = await fetch(dataUrl);
  return r.blob();
}
