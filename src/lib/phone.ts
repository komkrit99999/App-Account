/** "+66 81-234-5678" / "081 234 5678" → "0812345678" */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.startsWith("66") && digits.length >= 10 ? `0${digits.slice(2)}` : digits;
}
