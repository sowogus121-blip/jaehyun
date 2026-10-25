import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep PDF runtime and native canvas loader outside the server bundle.
  serverExternalPackages: ["pdf-parse"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
