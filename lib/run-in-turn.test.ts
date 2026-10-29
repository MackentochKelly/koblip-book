import { expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { runInTurn } = await import("./run-in-turn")

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test("tasks with the same key run one at a time, in order", async () => {
  const log: string[] = []
  const task = (name: string, ms: number) => async () => {
    log.push(`${name} start`)
    await wait(ms)
    log.push(`${name} end`)
    return name
  }
  const results = await Promise.all([
    runInTurn("biz-1", task("a", 20)),
    runInTurn("biz-1", task("b", 1)),
    runInTurn("biz-1", task("c", 1)),
  ])
  expect(results).toEqual(["a", "b", "c"])
  expect(log).toEqual([
    "a start",
    "a end",
    "b start",
    "b end",
    "c start",
    "c end",
  ])
})

test("tasks with different keys run together", async () => {
  const log: string[] = []
  await Promise.all([
    runInTurn("biz-1", async () => {
      log.push("1 start")
      await wait(20)
      log.push("1 end")
    }),
    runInTurn("biz-2", async () => {
      log.push("2 start")
      await wait(1)
      log.push("2 end")
    }),
  ])
  expect(log).toEqual(["1 start", "2 start", "2 end", "1 end"])
})

test("a failed task gives its error back and doesn't stop the next", async () => {
  const failed = runInTurn("biz-1", async () => {
    throw new Error("boom")
  })
  const next = runInTurn("biz-1", async () => "next")
  await expect(failed).rejects.toThrow("boom")
  await expect(next).resolves.toBe("next")
})
