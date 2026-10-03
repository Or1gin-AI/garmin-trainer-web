import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://dev.originai.cc/garmin-api/api/:path*',
      },
    ];
  },
};

export default nextConfig;
