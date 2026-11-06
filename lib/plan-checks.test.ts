// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "vitest"

import { PLAN_CHECKED_FEATURES } from "@/lib/plan-features"

// Every source file under these folders.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

// The features the code asks a plan for: hasFeature(…, "key"),
// ownerHasFeature(…, "key"), and voice ? "a" : "b" in a hasFeature call.
function checkedInCode(): Set<string> {
  const found = new Set<string>()
  const call = /(?:hasFeature|ownerHasFeature)\(([^()]*)\)/g
  for (const file of ["app", "features", "lib", "components"].flatMap(sourceFiles)) {
    for (const match of readFileSync(file, "utf8").matchAll(call)) {
      for (const key of (match[1] ?? "").matchAll(/"([a-zA-Z]+)"/g)) found.add(key[1]!)
    }
  }
  return found
}

test("the checked-features list matches the plan checks in the code", () => {
  expect([...checkedInCode()].sort()).toEqual([...PLAN_CHECKED_FEATURES].sort())
})
