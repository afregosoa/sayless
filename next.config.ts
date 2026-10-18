import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // Solo las fotos de eventos de nuestro bucket público de Supabase.
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/event-media/**" }]
      : [],
  },
  experimental: {
    // Las fotos se suben por Server Action. El navegador las reduce antes; Vercel limita la petición a ~4.5 MB.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
