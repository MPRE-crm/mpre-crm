// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ Enable App Router support inside /src/app
  experimental: {
    appDir: true,
  },

  // ✅ Optional: Ensure baseUrl paths like '@/lib/supabase' resolve correctly
  compiler: {
    removeConsole: false,
  },

  // ✅ Optional: Allow URLs from any origin for testing APIs like Twilio locally
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;


