import "server-only";

// Feature switches read from the environment (server only).

/**
 * Loans (/loans, the loans section on the customer page, loan server actions).
 * Off unless FEATURE_LOANS=1 — the code, tables and data stay in place.
 */
export function loansEnabled(): boolean {
  return process.env.FEATURE_LOANS === "1";
}
