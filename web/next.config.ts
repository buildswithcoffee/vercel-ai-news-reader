import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: { position: "bottom-left" }, // Ask Signal sits in the lower right
  // Interests and Sources became Setup, and How it works moved into Setup and X-ray.
  async redirects() {
    return [
      ...["/interests", "/sources", "/your-feed"].map((source) => ({ source, destination: "/setup", permanent: true })),
      { source: "/how-it-works", destination: "/xray", permanent: true },
    ];
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
