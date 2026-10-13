import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@smarttask/shared"],
  reactStrictMode: true,
  devIndicators: {
    position: "bottom-right",
  },
  // `next build` khi `next dev` đang chạy làm hỏng .next của dev → build ra thư mục riêng
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
