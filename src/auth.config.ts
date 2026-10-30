import type { NextAuthConfig } from "next-auth";

// DB-free config shared with proxy.ts. Providers live in auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    // Optimistic check only — real authorization happens in getCurrentUser()
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      // API routes answer 401/403 JSON themselves via withFeature()
      if (pathname.startsWith("/api/") || pathname.startsWith("/login")) return true;
      return !!auth?.user;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
