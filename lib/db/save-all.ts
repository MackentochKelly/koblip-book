import "server-only"
import type { BatchItem } from "drizzle-orm/batch"
import { db } from "./index"

// Runs several writes as one: all of them, or none if one fails. Use it
// instead of db.transaction(), which keeps the database's write lock while
// other code runs, so any other save at that moment fails with
// SQLITE_BUSY. libSQL runs a batch "in an implicit transaction" from start
// to finish in one call (orm.drizzle.team/docs/sqlite/batch-api). An empty
// list writes nothing.
export async function saveAll(items: BatchItem<"sqlite">[]): Promise<void> {
  const [first, ...rest] = items
  if (!first) {
    return
  }
  await db.batch([first, ...rest])
}
