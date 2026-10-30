"use client";

import { createContext, use, type ReactNode } from "react";
import type { Feature } from "@/lib/permissions";

// UI only: hides buttons/sections the user can't use. The server re-checks
// every request with requireFeature()/withFeature().
const PermissionsContext = createContext<readonly Feature[]>([]);

export function PermissionsProvider({
  features,
  children,
}: {
  features: readonly Feature[];
  children: ReactNode;
}) {
  return <PermissionsContext value={features}>{children}</PermissionsContext>;
}

export function useCan(feature: Feature): boolean {
  return use(PermissionsContext).includes(feature);
}

export function Can({
  feature,
  children,
  fallback = null,
}: {
  feature: Feature;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useCan(feature) ? children : fallback;
}
