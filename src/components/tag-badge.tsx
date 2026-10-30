import { tagColorClass } from "@/lib/tag-colors";

export function TagBadge({ name, color }: { name: string; color: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${tagColorClass(color)}`}>
      {name}
    </span>
  );
}
