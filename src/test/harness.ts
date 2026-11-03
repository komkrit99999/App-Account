// Integration-test harness: real route handlers, server actions, Prisma and a
// fresh SQLite database per test file. Only the parts that need a live Next.js
// request are replaced:
//   - @/auth          → returns whichever session loginAs() set (the JWT/cookie layer)
//   - next/navigation → redirect()/forbidden()/notFound() throw inspectable errors
//   - next/cache      → no-op revalidation
// Everything below the session (findCurrentUser re-reading role/tier/isActive
// from the DB, withFeature, requireFeature, queries) runs unmodified.
//
// Call setupIntegration() BEFORE importing any app module, then import them
// dynamically — mocks only apply to modules loaded after they are registered.
import { mock } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@/generated/prisma/client";

export class RedirectError extends Error {
  constructor(public url: string) {
    super(`redirect → ${url}`);
  }
}
export class ForbiddenError extends Error {
  constructor() {
    super("forbidden (403)");
  }
}
export class NotFoundError extends Error {
  constructor() {
    super("notFound (404)");
  }
}

export type TestUsers = Awaited<ReturnType<typeof seedUsers>>;

export async function setupIntegration() {
  const dir = mkdtempSync(path.join(tmpdir(), "app-account-test-"));
  process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
  process.env.IMPORT_STORAGE_DIR = path.join(dir, "imports");
  process.env.COMPANY_STORAGE_DIR = path.join(dir, "company");

  // Same migrations as production, applied to the throwaway DB
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: process.env, stdio: "pipe" });

  let session: { user: { id: string } } | null = null;

  mock.module("server-only", { exports: {} });
  mock.module("@/auth", { exports: { auth: async () => session } });
  mock.module("next/navigation", {
    exports: {
      redirect: (url: string) => {
        throw new RedirectError(url);
      },
      forbidden: () => {
        throw new ForbiddenError();
      },
      notFound: () => {
        throw new NotFoundError();
      },
    },
  });
  mock.module("next/cache", { exports: { revalidatePath: () => {}, revalidateTag: () => {} } });

  const { db } = (await import("@/lib/db")) as { db: PrismaClient };
  const users = await seedUsers(db);

  return {
    db,
    users,
    /** Pass null to act as a logged-out visitor */
    loginAs(user: { id: string } | null) {
      session = user ? { user: { id: user.id } } : null;
    },
    async cleanup() {
      await db.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function seedUsers(db: PrismaClient) {
  const make = (username: string, tier: number, role: "ADMIN" | "MEMBER" = "MEMBER", isActive = true) =>
    db.user.create({
      data: { username, passwordHash: "-", displayName: username, tier, role, isActive },
      select: { id: true, username: true, role: true, tier: true },
    });
  return {
    tier1: await make("tier1", 1),
    tier2: await make("tier2", 2),
    tier3: await make("tier3", 3),
    admin: await make("admin", 3, "ADMIN"),
    adminTier1: await make("admin-t1", 1, "ADMIN"),
    inactiveTier3: await make("inactive-t3", 3, "MEMBER", false),
  };
}

/** Runs a server action and returns where it redirected (fails if it didn't) */
export async function expectRedirect(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof RedirectError) return e.url;
    throw e;
  }
  throw new Error("expected a redirect");
}
