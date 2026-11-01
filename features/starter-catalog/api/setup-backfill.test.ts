// @vitest-environment node
import { readFileSync } from "node:fs"
import { createClient } from "@libsql/client"
import { expect, test } from "vitest"

test("0048 finishes only demos and owned businesses with services or team", async () => {
  const client = createClient({ url: "file::memory:" })
  try {
    await client.execute("CREATE TABLE businesses (id TEXT PRIMARY KEY, is_demo INTEGER NOT NULL, owner_id TEXT)")
    await client.execute("CREATE TABLE services (business_id TEXT)")
    await client.execute("CREATE TABLE team_members (business_id TEXT)")
    await client.execute(`INSERT INTO businesses (id, is_demo, owner_id) VALUES
      ('demo', 1, NULL), ('owned-demo', 1, 'owner'),
      ('services', 0, 'owner'), ('team', 0, 'owner'), ('both', 0, 'owner'),
      ('empty', 0, 'owner'), ('unclaimed', 0, NULL),
      ('unclaimed-services', 0, NULL), ('unclaimed-team', 0, NULL)`)
    await client.execute("INSERT INTO services VALUES ('services'), ('both'), ('unclaimed-services')")
    await client.execute("INSERT INTO team_members VALUES ('team'), ('both'), ('unclaimed-team')")

    const before = Date.now()
    const migration = readFileSync("drizzle/0048_short_gorgon.sql", "utf8")
    for (const statement of migration.split("--> statement-breakpoint")) {
      await client.execute(statement)
    }
    const { rows } = await client.execute("SELECT id, setup_finished_at FROM businesses ORDER BY id")
    for (const row of rows) {
      if (["demo", "owned-demo", "services", "team", "both"].includes(String(row.id))) {
        expect(row.setup_finished_at).toBeGreaterThanOrEqual(before)
        expect(row.setup_finished_at).toBeLessThanOrEqual(Date.now())
      } else {
        expect(row.setup_finished_at).toBeNull()
      }
    }
    await client.execute("INSERT INTO businesses (id, is_demo, owner_id) VALUES ('new', 0, 'owner')")
    const saved = await client.execute("SELECT setup_finished_at FROM businesses WHERE id = 'new'")
    expect(saved.rows[0].setup_finished_at).toBeNull()
  } finally {
    client.close()
  }
})
