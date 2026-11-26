import type { NextConfig } from "next";

// GitHub Pages serves the site from /<repo-name>, so production builds set
// NEXT_PUBLIC_BASE_PATH=/smartpack. Locally it is empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export", // static site: all backend logic lives in Supabase
  basePath,
  trailingSlash: true, // /login -> /login/index.html (works on GitHub Pages)
  images: { unoptimized: true },
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
