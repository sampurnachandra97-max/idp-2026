import type { NextConfig } from "next";

const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const config: NextConfig = {
  // Lets the development site work when it is opened through 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default config;
