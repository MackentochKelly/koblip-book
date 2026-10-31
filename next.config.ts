import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  // The WhatsApp page became Auto messages (D36): old links and bookmarks,
  // from its first name and the short-lived "Notifications", land on the
  // same part there. A page added at notifications/ must drop that rule.
  async redirects() {
    return ["whatsapp", "notifications"].map((old) => ({
      source: `/dashboard/:businessId/${old}/:path*`,
      destination: "/dashboard/:businessId/auto-messages/:path*",
      permanent: true,
    }))
  },
}

export default nextConfig
