/** "mesa_12" → 12; qualquer outra coisa → null. */
export const numeroDaMesa = (param: string): number | null => {
  const m = /^mesa_(\d{1,6})$/.exec(param);
  const n = m?.[1] ? Number(m[1]) : 0;
  return n >= 1 ? n : null;
};
