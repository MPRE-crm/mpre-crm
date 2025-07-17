// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ Enable App Router support inside /src/app
  experimental: {
    appDir: true,
  },
};

module.exports = nextConfig;


