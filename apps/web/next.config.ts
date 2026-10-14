import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@smarttask/shared"],
  reactStrictMode: true,
  devIndicators: {
    position: "bottom-right",
  },
  // `next build` khi `next dev` đang chạy làm hỏng .next của dev → build ra thư mục riêng
  // Trên Vercel (biến VERCEL) luôn dùng `.next` vì Vercel chỉ tìm thư mục này, bất kể script `build` đặt NEXT_DIST_DIR
  distDir: process.env.VERCEL ? ".next" : (process.env.NEXT_DIST_DIR ?? ".next"),
};

export default nextConfig;
