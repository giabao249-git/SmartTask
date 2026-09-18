import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@smarttask/shared"],
  reactStrictMode: true,
};

export default nextConfig;
