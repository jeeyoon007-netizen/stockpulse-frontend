import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // @ts-ignore - Some versions of Next.js require this at the root
  allowedDevOrigins: ["172.18.112.1", "localhost:3000"],
};

export default nextConfig;
