/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ Optional: Ensure baseUrl paths like '@/lib/supabase' resolve correctly
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

  // Add path aliases to support @ imports (optional if you don't have tsconfig path aliases yet)
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'crm-project/crm'), // Ensure alias points to 'crm' directory
    };
    return config;
  },
};

module.exports = nextConfig;
