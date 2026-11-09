import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: { position: "bottom-left" }, // Ask Signal sits in the lower right
  // Interests and Sources became one page.
  async redirects() {
    return ["/interests", "/sources"].map((source) => ({ source, destination: "/your-feed", permanent: true }));
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
