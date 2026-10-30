const moneyFormat = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTimeFormat = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

export function formatMoney(value: string | null | undefined): string {
  return value == null ? "–" : moneyFormat.format(Number(value));
}

export function formatDateTime(value: Date): string {
  return dateTimeFormat.format(value);
}
