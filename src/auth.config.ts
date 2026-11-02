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
      // Server Action POSTs must reach the action: redirecting them here sends the
      // login page back where React expects an action result ("An unexpected
      // response was received from the server"). Every action calls requireFeature(),
      // which redirects to /login in the way the client understands.
      if (request.headers.has("next-action")) return true;
      return !!auth?.user;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
