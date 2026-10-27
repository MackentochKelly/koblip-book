export interface OwnerPhoto { id: string; url: string }
export type PhotoError = "not_found" | "missing" | "too_big" | "wrong_type" | "limit"
export type PhotoResult<T = object> = ({ ok: true } & T) | { ok: false; error: PhotoError }
