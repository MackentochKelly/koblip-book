export const UPLOAD_RULES = {
  maxBytes: 4 * 1024 * 1024,
  maxBusinessPhotos: 12,
  types: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" },
} as const
export type UploadType = keyof typeof UPLOAD_RULES.types
