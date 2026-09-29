/** @type {import('next').NextConfig} */
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  // Código propio del Service Worker (Background Sync, push): ./worker/index.js
  customWorkerSrc: "worker",
  disable: process.env.NODE_ENV === "development",
  register: false, // lo registra components/providers/ServiceWorkerRegistrar
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false, // nunca recargar: podría perder una grabación en curso
  fallbacks: { document: "/offline" },
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.startsWith("/sounds/"),
        handler: "CacheFirst",
        options: { cacheName: "jarvis-sounds", expiration: { maxEntries: 60 } },
      },
      {
        urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
      },
    ],
  },
});

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }] },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=(self)" },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
