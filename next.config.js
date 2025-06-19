// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // If using Twilio and other external packages
  serverExternalPackages: ['twilio'],
  
  // Optionally, enabling React strict mode (not necessary but helps with debugging)
  reactStrictMode: true,
};

module.exports = nextConfig;
