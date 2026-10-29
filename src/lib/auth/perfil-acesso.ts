import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// Acesso à tabela public.perfis_acesso (papel + marcador "deve trocar a senha") e à função
// public.marcar_senha_trocada(). Os tipos vêm do types.ts gerado pelo Cloud.
export type PerfilAcesso = Pick<Tables<"perfis_acesso">, "papel" | "deve_trocar_senha">;

/** Perfil do usuário autenticado. `null` quando não existe linha (sem papel → sem acesso). */
export async function buscarPerfilAcesso(userId: string): Promise<PerfilAcesso | null> {
  const { data, error } = await supabase
    .from("perfis_acesso")
    .select("papel, deve_trocar_senha")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Desliga o marcador "deve trocar a senha" do usuário autenticado (a RLS impede escrita direta). */
export async function marcarSenhaTrocada(): Promise<void> {
  const { error } = await supabase.rpc("marcar_senha_trocada");
  if (error) throw error;
}
