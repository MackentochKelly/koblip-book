import "server-only"

import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"

export interface EmailMessage {
  to: string
  subject: string
  text: string
  html: string
}

let transporter: Transporter | null = null
let warnedMissing = false

function isConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.EMAIL_FROM
  )
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT)
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }
  return transporter
}

// Sends one email. Never throws: without SMTP setup it warns once and
// returns (so local dev works); a send failure only logs its message.
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!isConfigured()) {
    if (!warnedMissing) {
      warnedMissing = true
      console.warn("Email is not set up")
    }
    return
  }
  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
  }
}
