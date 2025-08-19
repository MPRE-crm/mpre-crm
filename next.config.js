/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ Disable lightningcss (fix for Vercel build issue)
  experimental: {
    optimizeCss: false,
  },

  compiler: {
    removeConsole: false,
  },

  // ✅ Allow URLs from any origin for testing APIs like Twilio locally
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

  // ✅ Add path aliases to support @ imports
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'crm-project/crm'),
    };
    return config;
  },
};

module.exports = nextConfig;
