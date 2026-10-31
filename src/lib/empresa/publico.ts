import { supabase } from "@/integrations/supabase/client";

export type ApresentacaoPublica = {
  empresa: {
    nome: string;
    slug: string;
    cor_primaria: string | null;
    cor_secundaria: string | null;
    logo_url: string | null;
    descricao: string | null;
    destaques: string[];
    horario_funcionamento: string | null;
    endereco: string | null;
  };
  mesas: { numero: number; disponivel: boolean }[];
};

export const chaveApresentacao = (slug: string) => ["apresentacao", slug] as const;

/** null = empresa inexistente ou desativada. */
export async function obterApresentacao(slug: string): Promise<ApresentacaoPublica | null> {
  const { data, error } = await supabase.rpc("obter_apresentacao_publica", { _slug: slug });
  if (error) {
    console.error("[apresentacao]", { codigo: error.code, mensagem: error.message });
    throw new Error("apresentacao_falhou");
  }
  return (data as ApresentacaoPublica | null) ?? null;
}
