import { supabase } from "@/integrations/supabase/client";
import { ErroEmpresa } from "./tipos";

export const BUCKET_LOGOS = "logos-empresas";
const LADO_MAX = 512;
const TAMANHO_MAX_ARQUIVO = 8 * 1024 * 1024;

/** Reduz o logo e mantém a transparência (PNG). */
export function arquivoParaLogoPng(arquivo: File): Promise<Blob> {
  return new Promise((resolver, rejeitar) => {
    if (!arquivo.type.startsWith("image/") || arquivo.size > TAMANHO_MAX_ARQUIVO) {
      rejeitar(new ErroEmpresa("logo_falhou"));
      return;
    }
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * escala));
      canvas.height = Math.max(1, Math.round(img.height * escala));
      const ctx = canvas.getContext("2d");
      if (!ctx) return rejeitar(new ErroEmpresa("logo_falhou"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (b) => (b ? resolver(b) : rejeitar(new ErroEmpresa("logo_falhou"))),
        "image/png",
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rejeitar(new ErroEmpresa("logo_falhou"));
    };
    img.src = url;
  });
}

/** Caminho do arquivo dentro do bucket a partir da URL pública (para apagar o logo antigo). */
export function caminhoDoLogo(url: string | null): string | null {
  if (!url) return null;
  const marca = `/${BUCKET_LOGOS}/`;
  const i = url.indexOf(marca);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marca.length).split("?")[0] ?? "");
}

/** Envia o logo (só o master tem permissão) e devolve a URL pública. */
export async function enviarLogo(empresaId: string, png: Blob): Promise<string> {
  const caminho = `${empresaId}/logo-${crypto.randomUUID().slice(0, 8)}.png`;
  const { error } = await supabase.storage
    .from(BUCKET_LOGOS)
    .upload(caminho, png, { contentType: "image/png", upsert: false });
  if (error) {
    console.error("[logo] envio", { mensagem: error.message });
    throw new ErroEmpresa("logo_falhou");
  }
  return supabase.storage.from(BUCKET_LOGOS).getPublicUrl(caminho).data.publicUrl;
}

/** Apaga logos que ficaram sem uso (falha silenciosa: não impede o salvamento). */
export async function apagarLogo(url: string | null): Promise<void> {
  const caminho = caminhoDoLogo(url);
  if (!caminho) return;
  const { error } = await supabase.storage.from(BUCKET_LOGOS).remove([caminho]);
  if (error) console.warn("[logo] não apagou o antigo", { mensagem: error.message });
}
