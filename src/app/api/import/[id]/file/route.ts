import { NextResponse } from "next/server";
import { withFeature } from "@/lib/authz";
import { readImportFile } from "@/server/import/storage";
import { canDownloadImport, findVisibleImportLog } from "@/server/history/queries";

const CONTENT_TYPES: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv; charset=utf-8",
};

// GET /api/import/:id/file — the original uploaded spreadsheet
export const GET = withFeature("viewOwnHistory", async (_req, ctx, user) => {
  const { id } = await ctx.params;
  // Logs the user may not see look exactly like missing ones
  const log = await findVisibleImportLog(user, String(id));
  if (!log) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });
  if (!canDownloadImport(user, log)) {
    return NextResponse.json({ error: "ไฟล์ของผู้อื่นอาจมีข้อมูลการเงิน ต้องมีสิทธิ์ดูข้อมูลการเงินจึงจะดาวน์โหลดได้" }, { status: 403 });
  }

  const data = log.fileStored ? await readImportFile(log.id) : null;
  if (!data) return NextResponse.json({ error: "ไม่พบไฟล์ต้นฉบับบนเซิร์ฟเวอร์" }, { status: 404 });

  const ext = log.fileName.split(".").pop()?.toLowerCase() ?? "";
  const asciiName = log.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(log.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
});
