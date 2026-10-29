import { criarServicoSupabase } from "./servico-supabase";
import type { ServicoAuth } from "./tipos";

/** Serviço de autenticação em uso: Supabase Auth via Lovable Cloud. */
export const authService: ServicoAuth = criarServicoSupabase();
