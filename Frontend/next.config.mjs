import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  // Pin the workspace root to this folder so Turbopack/Next only scans & watches
  // the frontend — not the whole monorepo (Backend, MobileApp, radiology-ai, db files).
  // This is what was making dev route compilation take 10-20s.
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: __dirname,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: false,
    formats: ["image/avif", "image/webp"],
  },
  // Proxy all /api/* requests through Next.js to the Laravel backend on localhost.
  // This means the browser never connects to port 8000 directly — it always goes through
  // port 3000 (the Next.js server), which then forwards to 127.0.0.1:8000 internally.
  // Benefit: the 192.168.1.3:8000 portproxy is no longer needed; only 127.0.0.1:8000
  // (the localhost portproxy) is used, which is far more stable.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
      {
        source: "/storage/:path*",
        destination: "http://127.0.0.1:8000/storage/:path*",
      },
    ]
  },
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-tooltip",
      "recharts",
      "date-fns",
    ],
  },
}

export default nextConfig
