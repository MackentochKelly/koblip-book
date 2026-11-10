import "server-only"

import {
  mkdir,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { PAYMENT_RULES } from "./payment-rules"
import { UPLOAD_RULES } from "./upload-rules"
import { sniffType } from "./uploads"

// Payment pictures (docs/plans/payment-proof.md): a customer's screenshot
// of a bank or payment app, so private. They live in their own folder,
// never under /uploads/ (which answers anyone), and are only read through
// app/api/payment-proof, which checks who is asking.
export function paymentProofsDir(): string {
  if (process.env.PAYMENT_PROOFS_DIR) {
    return process.env.PAYMENT_PROOFS_DIR
  }
  return path.join(process.cwd(), "data", "payment-proofs")
}

const FILE_NAME_PATTERN = /^[0-9a-f-]{36}\.jpg$/

type SaveError = "missing" | "too_big" | "wrong_type"

function missing(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "ENOENT"
  )
}

// Saves a picture and gives its file name. Same checks as other photos
// (real type, size), then drawn again as a JPEG: turned the right way up,
// no larger than proofMaxSide, and without the location and device data a
// phone writes into its pictures.
export async function saveProof(
  file: unknown
): Promise<{ ok: true; name: string } | { ok: false; error: SaveError }> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "missing" }
  }
  if (file.size > UPLOAD_RULES.maxBytes) {
    return { ok: false, error: "too_big" }
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!sniffType(bytes)) {
    return { ok: false, error: "wrong_type" }
  }
  let clean: Buffer
  try {
    clean = await sharp(bytes)
      .rotate()
      .resize({
        width: PAYMENT_RULES.proofMaxSide,
        height: PAYMENT_RULES.proofMaxSide,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer()
  } catch {
    // The first bytes looked right, the rest is not a picture.
    return { ok: false, error: "wrong_type" }
  }
  const dir = paymentProofsDir()
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true })
  const name = `${crypto.randomUUID()}.jpg`
  await writeFile(path.join(/*turbopackIgnore: true*/ dir, name), clean)
  return { ok: true, name }
}

export async function readProof(name: string | null): Promise<Buffer | null> {
  if (typeof name !== "string" || !FILE_NAME_PATTERN.test(name)) {
    return null
  }
  try {
    return await readFile(
      path.join(/*turbopackIgnore: true*/ paymentProofsDir(), name)
    )
  } catch (error) {
    if (missing(error)) return null
    throw error
  }
}

// Deletes a picture. A name that is not one of ours, or already gone, is
// left alone.
export async function deleteProof(name: string | null): Promise<void> {
  if (typeof name !== "string" || !FILE_NAME_PATTERN.test(name)) {
    return
  }
  try {
    await unlink(path.join(/*turbopackIgnore: true*/ paymentProofsDir(), name))
  } catch (error) {
    if (!missing(error)) throw error
  }
}

// Every picture in the store with when it was saved, for the clean-up to
// find the ones no booking holds any more.
export async function listProofs(): Promise<
  { name: string; savedAt: number }[]
> {
  const dir = paymentProofsDir()
  let names: string[]
  try {
    names = await readdir(/*turbopackIgnore: true*/ dir)
  } catch (error) {
    if (missing(error)) return []
    throw error
  }
  const found: { name: string; savedAt: number }[] = []
  for (const name of names.filter((item) => FILE_NAME_PATTERN.test(item))) {
    try {
      const info = await stat(path.join(/*turbopackIgnore: true*/ dir, name))
      found.push({ name, savedAt: info.mtimeMs })
    } catch (error) {
      // Deleted meanwhile.
      if (!missing(error)) throw error
    }
  }
  return found
}
