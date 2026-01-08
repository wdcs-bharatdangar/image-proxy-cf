import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: "/api/image-proxy",
        search: "",
      },
    ],
  },
};

export default nextConfig;
