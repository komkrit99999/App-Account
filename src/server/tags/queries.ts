import "server-only";
import { db } from "@/lib/db";

export function listTags() {
  return db.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } });
}

export function listTagsWithUsage() {
  return db.tag.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      _count: { select: { customers: { where: { customer: { deletedAt: null } } } } },
    },
  });
}
