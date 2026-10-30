import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  criarAdministrador,
  listarAdministradores,
  redefinirSenhaProvisoria,
} from "./logica.server";
import type { AdministradorListado, RespostaAdmin } from "./tipos";

// Funções de servidor da gestão de administradores. O middleware exige um usuário logado e a
// lógica confirma, no servidor, que ele é o master antes de usar a chave de serviço.
// O cliente de serviço é carregado só dentro do servidor (nunca vai para o navegador).
async function dependencias(usuario: Parameters<typeof listarAdministradores>[0]["usuario"]) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    void supabaseAdmin.auth; // dispara o erro se a chave de serviço não existir no ambiente
    return { usuario, admin: supabaseAdmin } as const;
  } catch (e) {
    console.error("[administradores] chave de serviço indisponível", (e as Error).message);
    return null;
  }
}

const semChave = { ok: false, codigo: "chave_servico_ausente" } as const;

export const listarAdministradoresFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RespostaAdmin<AdministradorListado[]>> => {
    const dep = await dependencias(context.supabase);
    return dep ? listarAdministradores(dep) : semChave;
  });

export const criarAdministradorFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async ({ context, data }): Promise<RespostaAdmin<{ usuarioId: string }>> => {
    const dep = await dependencias(context.supabase);
    return dep ? criarAdministrador(dep, data) : semChave;
  });

export const redefinirSenhaProvisoriaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async ({ context, data }): Promise<RespostaAdmin> => {
    const dep = await dependencias(context.supabase);
    return dep ? redefinirSenhaProvisoria(dep, data) : semChave;
  });
