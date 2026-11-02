import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Company logo for tax invoices. Back this folder up with the DB.
const DIR = process.env.COMPANY_STORAGE_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "company");
const LOGO = () => path.join(/*turbopackIgnore: true*/ DIR, "logo");

export const LOGO_MAX_BYTES = 1024 * 1024;

/** Detects PNG/JPEG/WebP from the file's first bytes — the browser-supplied type is not trusted */
export function sniffImage(buf: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function saveLogo(data: Buffer): Promise<void> {
  await mkdir(/*turbopackIgnore: true*/ DIR, { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ LOGO(), data);
}

export async function readLogo(): Promise<Buffer | null> {
  try {
    return await readFile(/*turbopackIgnore: true*/ LOGO());
  } catch {
    return null;
  }
}

export async function deleteLogo(): Promise<void> {
  await rm(/*turbopackIgnore: true*/ LOGO(), { force: true });
}
