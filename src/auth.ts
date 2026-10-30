import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";

class InactiveAccount extends CredentialsSignin {
  code = "inactive";
}

const credentialsSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { username, password } = parsed.data;
        const user = await db.user.findUnique({ where: { username } });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
        if (!user.isActive) throw new InactiveAccount();

        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, name: user.displayName };
      },
    }),
  ],
});
