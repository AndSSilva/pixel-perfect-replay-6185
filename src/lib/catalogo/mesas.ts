// Mesas: só o número. O endereço do QR é /{slug}/mesa_{numero}.
export const NUMERO_MESA_MAX = 9999;
export const MAX_MESAS_POR_VEZ = 50;

/** Trecho do endereço que identifica a mesa (ex.: "mesa_3"). */
export const codigoMesa = (numero: number) => `mesa_${numero}`;

/** Nome mostrado na tela (ex.: "Mesa 03"). */
export const rotuloMesa = (numero: number) => `Mesa ${String(numero).padStart(2, "0")}`;

export const caminhoMesa = (slug: string, numero: number) => `/${slug}/${codigoMesa(numero)}`;

export const urlMesa = (origem: string, slug: string, numero: number) =>
  `${origem}${caminhoMesa(slug, numero)}`;

/** Lê "mesa_12" e devolve 12; qualquer outra coisa devolve null. */
export function numeroDoCodigo(codigo: string): number | null {
  const m = /^mesa_([1-9]\d{0,3})$/.exec(codigo);
  return m ? Number(m[1]) : null;
}

/** Próximo número livre depois do maior já usado (1 se não houver mesas). */
export const proximoNumeroMesa = (numeros: readonly number[]) =>
  numeros.length === 0 ? 1 : Math.max(...numeros) + 1;

/** Lista de `quantidade` números a partir de `inicio`, sem passar do limite nem repetir os já usados. */
export function numerosParaCriar(
  inicio: number,
  quantidade: number,
  usados: readonly number[],
): number[] {
  const set = new Set(usados);
  const out: number[] = [];
  for (let n = inicio; out.length < quantidade && n <= NUMERO_MESA_MAX; n++)
    if (!set.has(n)) out.push(n);
  return out;
}
