import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted in a single container — skip the Image Optimization service so
  // the runtime image doesn't need `sharp`. Fine for an internal ERP.
  images: { unoptimized: true },
};

export default nextConfig;
