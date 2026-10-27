// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { createTransportMock, sendMailMock } = vi.hoisted(() => ({
  createTransportMock: vi.fn(),
  sendMailMock: vi.fn(),
}))

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}))

const SMTP_ENV = {
  SMTP_HOST: "mail.example.com",
  SMTP_PORT: "587",
  SMTP_USER: "user",
  SMTP_PASS: "pass",
  EMAIL_FROM: "Koblip Book <book@example.com>",
}

async function freshEmail() {
  vi.resetModules()
  createTransportMock.mockReset()
  sendMailMock.mockReset()
  sendMailMock.mockResolvedValue({})
  createTransportMock.mockReturnValue({ sendMail: sendMailMock })
  return import("./email")
}

afterEach(() => {
  vi.unstubAllEnvs()
})

test("without SMTP setup it warns once and never sends or throws", async () => {
  const { sendEmail } = await freshEmail()
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

  await expect(
    sendEmail({
      to: "owner@example.com",
      subject: "s",
      text: "t",
      html: "<p>t</p>",
    })
  ).resolves.toBeUndefined()
  await expect(
    sendEmail({
      to: "owner@example.com",
      subject: "s",
      text: "t",
      html: "<p>t</p>",
    })
  ).resolves.toBeUndefined()

  expect(createTransportMock).not.toHaveBeenCalled()
  expect(sendMailMock).not.toHaveBeenCalled()
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn).toHaveBeenCalledWith("Email is not set up")
  warn.mockRestore()
})

test("with SMTP setup it sends once through the lazy transport", async () => {
  for (const [key, value] of Object.entries(SMTP_ENV)) {
    vi.stubEnv(key, value)
  }
  const { sendEmail } = await freshEmail()

  await sendEmail({
    to: "owner@example.com",
    subject: "Confirm your email",
    text: "tap",
    html: "<p>tap</p>",
  })
  await sendEmail({
    to: "other@example.com",
    subject: "Confirm your email",
    text: "tap",
    html: "<p>tap</p>",
  })

  expect(createTransportMock).toHaveBeenCalledTimes(1)
  expect(createTransportMock).toHaveBeenCalledWith({
    host: "mail.example.com",
    port: 587,
    secure: false,
    auth: { user: "user", pass: "pass" },
  })
  expect(sendMailMock).toHaveBeenCalledTimes(2)
  expect(sendMailMock).toHaveBeenCalledWith({
    from: "Koblip Book <book@example.com>",
    to: "owner@example.com",
    subject: "Confirm your email",
    text: "tap",
    html: "<p>tap</p>",
  })
})

test("a send failure only logs its message", async () => {
  for (const [key, value] of Object.entries(SMTP_ENV)) {
    vi.stubEnv(key, value)
  }
  const { sendEmail } = await freshEmail()
  sendMailMock.mockRejectedValueOnce(new Error("smtp down"))
  const error = vi.spyOn(console, "error").mockImplementation(() => {})

  await expect(
    sendEmail({
      to: "owner@example.com",
      subject: "s",
      text: "t",
      html: "<p>t</p>",
    })
  ).resolves.toBeUndefined()

  expect(error).toHaveBeenCalledTimes(1)
  expect(error).toHaveBeenCalledWith("smtp down")
  error.mockRestore()
})
