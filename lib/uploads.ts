import "server-only"

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { UPLOAD_RULES, type UploadType } from "./upload-rules"

// Photos live in a runtime folder, not in the build: each file call has
// turbopackIgnore so Next does not trace the whole project into the output.
const EXT_TO_TYPE: Record<string, UploadType> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

export function uploadsDir(): string {
  if (process.env.UPLOADS_DIR) {
    return process.env.UPLOADS_DIR
  }
  return path.join(process.cwd(), "data", "uploads")
}

type SaveError = "missing" | "too_big" | "wrong_type"

function sniffType(bytes: Uint8Array): UploadType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg"
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png"
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp"
  }
  return null
}

export async function savePhoto(
  file: File
): Promise<{ ok: true; url: string } | { ok: false; error: SaveError }> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "missing" }
  }
  if (file.size > UPLOAD_RULES.maxBytes) {
    return { ok: false, error: "too_big" }
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffType(bytes)
  if (!type) {
    return { ok: false, error: "wrong_type" }
  }
  const dir = uploadsDir()
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true })
  const name = `${crypto.randomUUID()}.${UPLOAD_RULES.types[type]}`
  await writeFile(path.join(/*turbopackIgnore: true*/ dir, name), bytes)
  return { ok: true, url: `/uploads/${name}` }
}

const STORED_URL_PATTERN =
  /^\/uploads\/[0-9a-f-]{36}\.(jpg|png|webp)$/

const FILE_NAME_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp)$/

export async function deletePhoto(url: string | null): Promise<void> {
  if (typeof url !== "string" || !STORED_URL_PATTERN.test(url)) {
    return
  }
  const name = url.slice("/uploads/".length)
  try {
    await unlink(path.join(/*turbopackIgnore: true*/ uploadsDir(), name))
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return
    }
    throw error
  }
}

export async function readPhoto(
  name: string
): Promise<{ bytes: Buffer; type: UploadType } | null> {
  if (!FILE_NAME_PATTERN.test(name)) {
    return null
  }
  const ext = name.slice(name.lastIndexOf(".") + 1)
  const type = EXT_TO_TYPE[ext]
  if (!type) {
    return null
  }
  let bytes: Buffer
  try {
    bytes = await readFile(path.join(/*turbopackIgnore: true*/ uploadsDir(), name))
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null
    }
    throw error
  }
  return { bytes, type }
}
