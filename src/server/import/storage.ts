import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Original uploaded files, one per ImportLog id. Back this folder up together with the DB.
// turbopackIgnore: runtime data, not part of the build output.
const DIR = process.env.IMPORT_STORAGE_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "imports");

// ids are cuids; refuse anything else so a crafted id can't escape DIR
const filePath = (id: string) => {
  if (!/^[a-z0-9]+$/i.test(id)) throw new Error("invalid import id");
  return path.join(/*turbopackIgnore: true*/ DIR, id);
};

export async function saveImportFile(id: string, data: Buffer): Promise<void> {
  await mkdir(/*turbopackIgnore: true*/ DIR, { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ filePath(id), data);
}

export async function readImportFile(id: string): Promise<Buffer | null> {
  try {
    return await readFile(/*turbopackIgnore: true*/ filePath(id));
  } catch {
    return null;
  }
}
