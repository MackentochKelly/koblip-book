import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  // The WhatsApp page is Automations (D36, D38, D39): old links and
  // bookmarks, from its earlier names, land on the same part there, with
  // their filters.
  async redirects() {
    return [
      ...["whatsapp", "auto-messages", "notifications"].map((old) => ({
        source: `/dashboard/:businessId/${old}/:path*`,
        destination: "/dashboard/:businessId/automations/:path*",
        permanent: true,
      })),
      // Hours is a part of Settings (D40).
      {
        source: "/dashboard/:businessId/hours",
        destination: "/dashboard/:businessId/settings/hours",
        permanent: true,
      },
      // The bell's choices screen was briefly named Updates (N-D12, N-D13).
      {
        source: "/dashboard/:businessId/settings/updates",
        destination: "/dashboard/:businessId/settings/notifications",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
