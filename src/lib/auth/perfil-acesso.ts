import { supabase } from "@/integrations/supabase/client";

// Acesso à tabela public.perfis_acesso (papel + marcador "deve trocar a senha") e à função
// public.marcar_senha_trocada(). Tipagem local até o types.ts do Cloud trazer a tabela;
// quando trouxer, os casts abaixo podem ser removidos.
export type PapelApp = "admin" | "master";

export interface PerfilAcesso {
  papel: PapelApp;
  deve_trocar_senha: boolean;
}

interface ErroBanco {
  message: string;
}

interface ClienteSemTipos {
  from(tabela: "perfis_acesso"): {
    select(colunas: string): {
      eq(
        coluna: string,
        valor: string,
      ): { maybeSingle(): PromiseLike<{ data: PerfilAcesso | null; error: ErroBanco | null }> };
    };
  };
  rpc(funcao: "marcar_senha_trocada"): PromiseLike<{ error: ErroBanco | null }>;
}

const cliente = () => supabase as unknown as ClienteSemTipos;

/** Perfil do usuário autenticado. `null` quando não existe linha (sem papel → sem acesso). */
export async function buscarPerfilAcesso(userId: string): Promise<PerfilAcesso | null> {
  const { data, error } = await cliente()
    .from("perfis_acesso")
    .select("papel, deve_trocar_senha")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Desliga o marcador "deve trocar a senha" do usuário autenticado (a RLS impede escrita direta). */
export async function marcarSenhaTrocada(): Promise<void> {
  const { error } = await cliente().rpc("marcar_senha_trocada");
  if (error) throw new Error(error.message);
}
