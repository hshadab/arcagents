/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@arc-agent/sdk'],
  // Mark native modules as external for server builds
  experimental: {
    serverComponentsExternalPackages: ['onnxruntime-node'],
  },
  // Security headers including CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_ALLOWED_ORIGIN || 'http://localhost:3000' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-API-Key' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none';"
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Externalize onnxruntime-node for server builds
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('onnxruntime-node');
    }

    // Handle MetaMask SDK's React Native dependencies (browser-only)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        'react-native': false,
        '@react-native-async-storage/async-storage': false,
      };

      // Provide empty modules for React Native deps
      config.resolve.alias = {
        ...config.resolve.alias,
        '@react-native-async-storage/async-storage': false,
      };
    }

    // Ignore warnings from pino (used by WalletConnect)
    config.ignoreWarnings = [
      { module: /node_modules\/pino/ },
      { module: /node_modules\/@metamask\/sdk/ },
    ];

    return config;
  },
};

module.exports = nextConfig;
