/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@arc-agent/sdk'],
  // Mark native modules as external for server builds
  experimental: {
    serverComponentsExternalPackages: ['onnxruntime-node'],
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
