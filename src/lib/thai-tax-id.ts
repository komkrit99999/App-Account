// Thai 13-digit tax / national ID.
// Check digit: sum(d[i] * (13 - i)) for i = 0..11, then (11 - sum % 11) % 10.

export function normalizeTaxId(input: string): string {
  return input.replace(/[\s-]/g, "");
}

export function isValidThaiTaxId(input: string): boolean {
  const id = normalizeTaxId(input);
  if (!/^\d{13}$/.test(id)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

/** 0105556123456 → 0-1055-56123-45-6 */
export function formatTaxId(id: string): string {
  return /^\d{13}$/.test(id)
    ? `${id[0]}-${id.slice(1, 5)}-${id.slice(5, 10)}-${id.slice(10, 12)}-${id[12]}`
    : id;
}
