import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // If using Twilio and other external packages
  serverExternalPackages: ['twilio'],
  
  // Optionally, enabling React strict mode (not necessary but helps with debugging)
  reactStrictMode: true,
};

export default nextConfig;
