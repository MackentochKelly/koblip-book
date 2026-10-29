// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

const { auth } = vi.hoisted(() => ({
  auth: { api: { banUser: vi.fn(), unbanUser: vi.fn() } },
}))

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth", () => ({ auth }))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({
    userId: "admin",
    name: "Admin",
    email: "admin@example.com",
  })),
}))

const { setOwnerBlocked } = await import("./actions")

beforeEach(() => {
  vi.clearAllMocks()
})

test("an admin can't block their own account", async () => {
  expect(await setOwnerBlocked("admin", true)).toEqual({ ok: false })
  expect(auth.api.banUser).not.toHaveBeenCalled()
})

test("blocking and unblocking go through the admin plugin", async () => {
  expect(await setOwnerBlocked("u1", true)).toEqual({ ok: true })
  expect(auth.api.banUser).toHaveBeenCalledWith(
    expect.objectContaining({ body: { userId: "u1" } })
  )
  expect(await setOwnerBlocked("u1", false)).toEqual({ ok: true })
  expect(auth.api.unbanUser).toHaveBeenCalledOnce()
})

test("a failed block says so", async () => {
  auth.api.banUser.mockRejectedValueOnce(new Error("down"))
  expect(await setOwnerBlocked("u1", true)).toEqual({ ok: false })
})
