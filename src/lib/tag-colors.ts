// Full class strings so Tailwind can see them
export const TAG_COLORS = {
  slate: "bg-slate-100 text-slate-700 ring-slate-300",
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  pink: "bg-pink-50 text-pink-700 ring-pink-200",
} as const;

export type TagColor = keyof typeof TAG_COLORS;

export const TAG_COLOR_LABELS: Record<TagColor, string> = {
  slate: "เทา",
  red: "แดง",
  amber: "เหลือง",
  green: "เขียว",
  blue: "น้ำเงิน",
  violet: "ม่วง",
  pink: "ชมพู",
};

export function tagColorClass(color: string): string {
  return TAG_COLORS[color as TagColor] ?? TAG_COLORS.slate;
}
