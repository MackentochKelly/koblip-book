import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  // The WhatsApp page became Notifications (D36, D38): old links and
  // bookmarks, from its first name and the short-lived "Auto messages", land
  // on the same part there, with their filters.
  async redirects() {
    return ["whatsapp", "auto-messages"].map((old) => ({
      source: `/dashboard/:businessId/${old}/:path*`,
      destination: "/dashboard/:businessId/notifications/:path*",
      permanent: true,
    }))
  },
}

export default nextConfig
