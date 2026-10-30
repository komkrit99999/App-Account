import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off: every page here reads the session and
  // permission changes must apply on the next request, so there is
  // nothing worth prerendering.
  experimental: {
    // Enables forbidden() → src/app/forbidden.tsx
    authInterrupts: true,
    // Spreadsheet uploads go through a Server Action (file limit is 5 MB)
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
