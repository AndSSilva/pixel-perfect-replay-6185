import { z } from "zod";
import { REQUISITOS_SENHA, SENHA_MAX } from "@/lib/auth/validacao";

export const MAX_EMPRESAS_POR_ADMIN = 100;

const email = z
  .string()
  .trim()
  .min(1, "Informe o e-mail.")
  .max(254, "E-mail muito longo.")
  .email("Informe um e-mail válido.")
  .transform((v) => v.toLowerCase());

const senhaProvisoria = z
  .string()
  .max(SENHA_MAX, "Senha muito longa.")
  .refine(
    (s) => REQUISITOS_SENHA.every((r) => r.ok(s)),
    "A senha provisória não atende aos requisitos.",
  );

const empresaIds = z.array(z.string().uuid()).max(MAX_EMPRESAS_POR_ADMIN);

export const esquemaNovoAdministrador = z.object({
  email,
  senhaProvisoria,
  empresaIds: empresaIds.transform((ids) => [...new Set(ids)]),
});

export const esquemaRedefinirSenha = z.object({
  usuarioId: z.string().uuid(),
  senhaProvisoria,
});

export type NovoAdministrador = z.infer<typeof esquemaNovoAdministrador>;
export type RedefinirSenha = z.infer<typeof esquemaRedefinirSenha>;

// Sem caracteres ambíguos (0/O, 1/l/I) para facilitar o repasse por telefone ou mensagem.
const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const NUMEROS = "23456789";
const ALFABETO = LETRAS + NUMEROS;

function inteiroAleatorio(limite: number): number {
  // Amostragem com rejeição: sem viés de módulo.
  const max = Math.floor(0x100000000 / limite) * limite;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0]! < max) return buf[0]! % limite;
  }
}

const sortear = (conjunto: string) => conjunto[inteiroAleatorio(conjunto.length)]!;

/** Senha provisória forte (14 caracteres, com letras e números), gerada com aleatoriedade criptográfica. */
export function gerarSenhaProvisoria(tamanho = 14): string {
  const chars = [sortear(LETRAS), sortear(NUMEROS)];
  while (chars.length < tamanho) chars.push(sortear(ALFABETO));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = inteiroAleatorio(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
