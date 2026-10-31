// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

const session = vi.fn()
const feedFor = vi.fn()
vi.mock("@/lib/dal", () => ({ getSession: session }))
vi.mock("@/features/notifications/api/queries", () => ({ feedFor }))

const { GET } = await import("./route")

beforeEach(() => {
  session.mockReset()
  feedFor.mockReset()
})

test("the signed-in owner gets their count and a page, never cached", async () => {
  session.mockResolvedValue({ userId: "u1" })
  feedFor.mockResolvedValue({ unread: 2, page: { items: [], nextCursor: null } })
  const response = await GET(new Request("http://localhost/api/notifications?cursor=c1"))
  expect(feedFor).toHaveBeenCalledWith("u1", "c1")
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  expect(await response.json()).toEqual({ unread: 2, page: { items: [], nextCursor: null } })
})

test("signed out: 401, nothing read", async () => {
  session.mockResolvedValue(null)
  const response = await GET(new Request("http://localhost/api/notifications"))
  expect(response.status).toBe(401)
  expect(feedFor).not.toHaveBeenCalled()
})
