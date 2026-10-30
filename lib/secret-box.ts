import "server-only"
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

// Seals a secret (an app token) before it is stored, with AES-256-GCM and the
// TOKEN_ENCRYPTION_KEY from .env.local (32 random bytes, base64). A sealed
// value that was changed, or sealed with another key, does not open.
const VERSION = "v1"

function key() {
  const value = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? "", "base64")
  if (value.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be 32 bytes in base64. See .env.example."
    )
  }
  return value
}

export function seal(secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()])
  return [VERSION, iv, cipher.getAuthTag(), data]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".")
}

export function open(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".")
  if (version !== VERSION || !iv || !tag || !data) {
    throw new Error("Not a sealed value")
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64url")
  )
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}
