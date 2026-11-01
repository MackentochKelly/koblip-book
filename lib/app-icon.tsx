import "server-only"

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

// The app's square icon at any size: the Koblip logo on white, the logo
// about three quarters as wide as the square. Used for the iPhone's Home
// Screen icon and the install icons in app/manifest.ts.
export async function appIcon(size: number): Promise<ImageResponse> {
  const logo = await readFile(join(process.cwd(), "public/koblip-logo.png"))
  // The logo file is 2008 × 612.
  const width = Math.round(size * 0.78)
  const height = Math.round((width * 612) / 2008)
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "white",
      }}
    >
      <img
        src={`data:image/png;base64,${logo.toString("base64")}`}
        width={width}
        height={height}
        alt=""
      />
    </div>,
    { width: size, height: size }
  )
}
