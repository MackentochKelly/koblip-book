import { ASSISTANT_RULES } from "@/lib/assistant-rules"

// What an answer looked up, kept on the reply so the next question can
// use the ids ("cancel Ana's") without looking them up again. Built on
// the server from tool results, kept by the screen, sent back with the
// words. Every tool still checks the business, so a made-up id reaches
// nothing.
export const MEMORY_KINDS = ["booking", "service", "team", "extras"] as const
export type MemoryKind = (typeof MEMORY_KINDS)[number]

export interface MemoryRow {
  kind: MemoryKind
  id: string
  label: string // short: "Ana · Cut · 2026-10-31 10:00 · confirmed"
}

const MAX_ID = 64
const MAX_LABEL = 120

// The rows, or null when they are not memory rows or too many. A missing
// value is no memory.
export function cleanMemory(value: unknown): MemoryRow[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > ASSISTANT_RULES.maxMemoryRows) {
    return null
  }
  const rows: MemoryRow[] = []
  for (const row of value) {
    if (typeof row !== "object" || row === null) return null
    const { kind, id, label } = row as Record<string, unknown>
    if (
      !MEMORY_KINDS.includes(kind as MemoryKind) ||
      typeof id !== "string" ||
      id === "" ||
      id.length > MAX_ID ||
      typeof label !== "string" ||
      label.length > MAX_LABEL
    ) {
      return null
    }
    rows.push({ kind: kind as MemoryKind, id, label })
  }
  return rows
}

// One row from a tool result's record, or null when its id is not one.
// The label joins the given words, cut to its limit.
export function memoryRow(
  kind: MemoryKind,
  id: unknown,
  parts: unknown[]
): MemoryRow | null {
  if (typeof id !== "string" || id === "" || id.length > MAX_ID) return null
  const label = parts
    .filter((part): part is string => typeof part === "string" && part !== "")
    .join(" · ")
    .slice(0, MAX_LABEL)
  return { kind, id, label }
}
