import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

// Redirects to /login when there's no session (see authConfig.callbacks.authorized)
export default auth;

export const config = {
  // Everything except Auth.js routes, Next internals and static files
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
