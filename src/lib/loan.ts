// Loan rules shared by the form, the server and the list. Client-safe.

/**
 * Legal maximum for a private (non-licensed) loan: 15% per year
 * (ป.พ.พ. มาตรา 654; charging more is an offence under
 * พ.ร.บ.ห้ามเรียกดอกเบี้ยเกินอัตรา พ.ศ. 2560). Every loan write is checked
 * against this on the server. Change it only with a licence that allows a
 * higher rate (e.g. พิโกไฟแนนซ์) and the rate that licence permits.
 */
export const MAX_INTEREST_RATE_PER_YEAR = 15;

/** Simple interest for one month, rounded to satang */
export function monthlyInterest(principal: string | number, ratePerYear: string | number): number {
  return Math.round((Number(principal) * Number(ratePerYear)) / 12) / 100;
}

export function dueDayLabel(day: number): string {
  return day === 31 ? "สิ้นเดือน" : `วันที่ ${day}`;
}

/** Last day of the month when the month is shorter than the due day */
export function isInterestDueOn(dueDay: number, date: Date): boolean {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() === Math.min(dueDay, lastDay);
}
