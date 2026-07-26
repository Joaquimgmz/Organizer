import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @libsql/client ships native bindings per-platform; keep it out of the
  // bundler graph so Next.js resolves it at runtime instead of bundling it.
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
