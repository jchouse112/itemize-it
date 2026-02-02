const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Ensure webpack resolves React 19 from this workspace first, not the hoisted root
  // (root node_modules has React 18 for React Native / Expo packages)
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.modules = [
      path.resolve(__dirname, "node_modules"),
      ...(config.resolve.modules || ["node_modules"]),
    ];
    return config;
  },

  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
