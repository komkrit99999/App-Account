const moneyFormat = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTimeFormat = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

export function formatMoney(value: string | null | undefined): string {
  return value == null ? "–" : moneyFormat.format(Number(value));
}

export function formatDateTime(value: Date): string {
  return dateTimeFormat.format(value);
}

// Date-only values (loan dates) are stored as UTC midnight
const dateFormat = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "UTC" });

export function formatDate(value: Date): string {
  return dateFormat.format(value);
}

/** "2026-10-30" for <input type="date"> */
/** Today's date in server-local time, same shape as toDateInput() */
export function todayDateInput(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function toDateInput(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}
