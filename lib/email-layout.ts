// The one layout every Koblip Book email uses (docs/plans/email.md, EM-D12):
// who it is from on top, a title, one short paragraph, the booking's lines,
// one button, a short note, and a footer. No images, no tracking. Each email
// goes as HTML and as its plain-text twin.
//
// Email clients ignore stylesheets and CSS variables, so the HTML is tables
// with inline styles, and the brand's colours are written out here once:
// the light theme's tokens in app/globals.css. Emails stay light
// (color-scheme), as most booking emails do, so every client draws them the
// same.

export const EMAIL_COLORS = {
  // --background (the app's page) and --card
  page: "#f8f9fa",
  card: "#ffffff",
  // The logo's ink, for the title (koblip-brand: Ink)
  ink: "#171a40",
  // --foreground, --muted-foreground, --border
  text: "#0a0a0a",
  muted: "#6c6c6c",
  border: "#e5e5e5",
  // --primary and --primary-foreground
  primary: "#432dd7",
  primaryText: "#eef2ff",
} as const

const FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const TITLE_FONT = `'Inter Tight', ${FONT}`

export interface EmailLine {
  label: string
  value: string
}

export interface EmailLayout {
  // The inbox's preview line; the lead when not given.
  preheader?: string
  // Who it is from: the business's name, or the app's.
  heading: string
  title: string
  lead: string
  lines?: EmailLine[]
  button?: { label: string; url: string }
  note?: string
  // Why the email came, and the link that stops them (EM-D10).
  footer?: string
  stop?: { label: string; url: string }
}

export interface EmailBody {
  text: string
  html: string
}

// Names, links and the business's own words are text, never markup.
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function textTwin(email: EmailLayout): string {
  const parts = [email.heading, email.title, email.lead]
  if (email.lines?.length) {
    parts.push(email.lines.map((line) => `${line.label}: ${line.value}`).join("\n"))
  }
  if (email.button) parts.push(`${email.button.label}: ${email.button.url}`)
  if (email.note) parts.push(email.note)
  const footer = [email.footer, email.stop && `${email.stop.label}: ${email.stop.url}`]
    .filter(Boolean)
    .join("\n")
  if (footer) parts.push(`--\n${footer}`)
  return parts.join("\n\n")
}

function linesHtml(lines: EmailLine[]): string {
  const rows = lines
    .map(
      (line, index) =>
        `<tr><td style="padding:12px 0;${index ? `border-top:1px solid ${EMAIL_COLORS.border};` : ""}">` +
        `<div style="font-size:13px;line-height:18px;color:${EMAIL_COLORS.muted};">${escapeHtml(line.label)}</div>` +
        `<div style="font-size:15px;line-height:22px;color:${EMAIL_COLORS.text};">${escapeHtml(line.value)}</div>` +
        `</td></tr>`
    )
    .join("")
  return (
    `<tr><td style="padding:8px 0 0;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>` +
    `</td></tr>`
  )
}

// A button every client draws, Outlook included: the colour is on the cell.
function buttonHtml(button: { label: string; url: string }): string {
  const url = escapeHtml(button.url)
  return (
    `<tr><td style="padding:24px 0 0;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td bgcolor="${EMAIL_COLORS.primary}" style="border-radius:26px;background:${EMAIL_COLORS.primary};">` +
    `<a href="${url}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:${EMAIL_COLORS.primaryText};text-decoration:none;border-radius:26px;">${escapeHtml(button.label)}</a>` +
    `</td></tr></table>` +
    `</td></tr>`
  )
}

function html(email: EmailLayout): string {
  const preheader = email.preheader ?? email.lead
  const body = [
    `<tr><td style="padding:0 0 16px;font-size:14px;line-height:20px;font-weight:600;color:${EMAIL_COLORS.ink};">${escapeHtml(email.heading)}</td></tr>`,
    `<tr><td style="padding:0 0 8px;font-family:${TITLE_FONT};font-size:24px;line-height:30px;font-weight:500;letter-spacing:-0.01em;color:${EMAIL_COLORS.ink};">${escapeHtml(email.title)}</td></tr>`,
    `<tr><td style="font-size:16px;line-height:24px;color:${EMAIL_COLORS.text};">${escapeHtml(email.lead)}</td></tr>`,
    email.lines?.length ? linesHtml(email.lines) : "",
    email.button ? buttonHtml(email.button) : "",
    email.note
      ? `<tr><td style="padding:24px 0 0;font-size:14px;line-height:20px;color:${EMAIL_COLORS.muted};">${escapeHtml(email.note)}</td></tr>`
      : "",
  ].join("")
  const footer = [
    email.footer ? escapeHtml(email.footer) : "",
    email.stop
      ? `<a href="${escapeHtml(email.stop.url)}" style="color:${EMAIL_COLORS.muted};text-decoration:underline;">${escapeHtml(email.stop.label)}</a>`
      : "",
  ]
    .filter(Boolean)
    .join("<br>")

  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">` +
    `<title>${escapeHtml(email.title)}</title></head>` +
    `<body style="margin:0;padding:0;background:${EMAIL_COLORS.page};">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${EMAIL_COLORS.page}" style="background:${EMAIL_COLORS.page};">` +
    `<tr><td align="center" style="padding:24px 16px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">` +
    `<tr><td bgcolor="${EMAIL_COLORS.card}" style="background:${EMAIL_COLORS.card};border-radius:26px;padding:32px 24px;font-family:${FONT};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>` +
    `</td></tr>` +
    (footer
      ? `<tr><td style="padding:16px 24px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${EMAIL_COLORS.muted};text-align:center;">${footer}</td></tr>`
      : "") +
    `</table></td></tr></table></body></html>`
  )
}

// One email's HTML and plain text, from the same parts.
export function renderEmail(email: EmailLayout): EmailBody {
  return { text: textTwin(email), html: html(email) }
}
