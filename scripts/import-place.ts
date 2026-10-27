import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
// @next/env ships as CommonJS, so it loads through require even in ESM.
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

const { importPlace } =
  await import("../features/place-import/api/import-place")

const input = process.argv[2]
if (!input) {
  console.error('Usage: npm run import:place -- "<link or name>"')
  process.exit(1)
}

const slug = await importPlace(input)
console.log(`/b/${slug}`)
