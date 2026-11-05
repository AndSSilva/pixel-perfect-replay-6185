import { supabase } from "@/integrations/supabase/client";
import type { Horarios, Intervalo } from "./horarios";
import { codigoDoErroEmpresa } from "./servico";
import { ErroEmpresa } from "./tipos";

/** Identidade da INOV4 (fica no código: o master edita só os textos da página). */
export const INOV4 = {
  nome: "INOV4 HUB",
  logo: "/brand/simbolo-circulo-dark.png",
  fundo: "#0F172A",
  primaria: "#2563EB",
} as const;

/** Textos da página da INOV4 (link raiz). */
export type ApresentacaoPlataforma = {
  descricao: string | null;
  whatsapp: string | null;
  instagram: string | null;
  endereco: string | null;
  horarios: Horarios | null;
  intervalo: Intervalo | null;
};

export const chavePlataforma = ["plataforma"] as const;

export async function obterPlataforma(): Promise<ApresentacaoPlataforma> {
  const { data, error } = await supabase.rpc("obter_apresentacao_plataforma");
  if (error) {
    console.error("[plataforma]", { codigo: error.code, mensagem: error.message });
    throw new Error("plataforma_falhou");
  }
  return data as ApresentacaoPlataforma;
}

export async function atualizarPlataforma(d: {
  descricao: string;
  whatsapp: string;
  instagram: string;
  endereco: string;
  horarios: Horarios | null;
  intervalo: Intervalo | null;
}): Promise<void> {
  const { error } = await supabase.rpc("atualizar_apresentacao_plataforma", {
    _descricao: d.descricao,
    _whatsapp: d.whatsapp,
    _instagram: d.instagram,
    _endereco: d.endereco,
    _horarios: d.horarios,
    _intervalo: d.intervalo,
  });
  if (error) {
    console.error("[plataforma]", { codigo: error.code, mensagem: error.message });
    throw new ErroEmpresa(codigoDoErroEmpresa(error));
  }
}
