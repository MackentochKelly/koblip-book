import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

// The icon an iPhone shows when the page is added to its Home Screen
// (nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons):
// the Koblip logo on white, 180 × 180, made once at build time.
export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default async function AppleIcon() {
  const logo = await readFile(join(process.cwd(), "public/koblip-logo.png"))
  return new ImageResponse(
    (
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
          width={140}
          height={43}
          alt=""
        />
      </div>
    ),
    size
  )
}
