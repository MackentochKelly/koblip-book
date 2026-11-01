// A photo upload's answer (owner area, team area): ok with what it saved,
// or why it was refused.
export type PhotoError = "not_found" | "missing" | "too_big" | "wrong_type" | "limit"
export type PhotoResult<T = object> = ({ ok: true } & T) | { ok: false; error: PhotoError }
