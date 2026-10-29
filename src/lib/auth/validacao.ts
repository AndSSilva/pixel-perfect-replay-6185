import { z } from "zod";

export const SENHA_MIN = 8;
export const SENHA_MAX = 72; // limite prático do bcrypt usado pelo Supabase Auth

const email = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail.")
  .max(254, "E-mail muito longo.")
  .email("Informe um e-mail válido.")
  .transform((v) => v.toLowerCase());

export const esquemaLogin = z.object({
  email,
  senha: z.string().min(1, "Informe sua senha.").max(SENHA_MAX, "Senha muito longa."),
});

export const esquemaEmail = z.object({ email });

export const REQUISITOS_SENHA = [
  {
    id: "tamanho",
    rotulo: `Pelo menos ${SENHA_MIN} caracteres`,
    ok: (s: string) => s.length >= SENHA_MIN,
  },
  { id: "letra", rotulo: "Pelo menos uma letra", ok: (s: string) => /\p{L}/u.test(s) },
  { id: "numero", rotulo: "Pelo menos um número", ok: (s: string) => /\d/.test(s) },
] as const;

const SENHA_ATUAL_MAX = 128;

/** Esquema do formulário de nova senha; `pedirSenhaAtual` inclui a senha atual (primeiro acesso). */
export const criarEsquemaNovaSenha = (pedirSenhaAtual: boolean) =>
  z
    .object({
      senhaAtual: pedirSenhaAtual
        ? z.string().min(1, "Informe a senha atual.").max(SENHA_ATUAL_MAX, "Senha muito longa.")
        : z.string().optional(),
      senha: z
        .string()
        .max(SENHA_MAX, "Senha muito longa.")
        .refine(
          (s) => REQUISITOS_SENHA.every((r) => r.ok(s)),
          "A senha não atende aos requisitos.",
        ),
      confirmacao: z.string(),
    })
    .refine((v) => v.senha === v.confirmacao, {
      path: ["confirmacao"],
      message: "As senhas não coincidem.",
    });

export const esquemaNovaSenha = criarEsquemaNovaSenha(false);

export type DadosLogin = z.infer<typeof esquemaLogin>;
export type DadosEmail = z.infer<typeof esquemaEmail>;
export type DadosNovaSenha = z.infer<typeof esquemaNovaSenha>;
