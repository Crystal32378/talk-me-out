import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // The try-on route imports sharp directly. Keep its Linux native binary and
  // libvips payload in the Vercel function bundle; otherwise the traced
  // function can contain sharp.node without the shared library it loads.
  outputFileTracingIncludes: {
    "/api/tryon": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
};

export default nextConfig;
