import { stopEmails } from "@/lib/email-stop"

// Mail apps' own unsubscribe button (RFC 8058): a POST to the
// List-Unsubscribe link, with "List-Unsubscribe=One-Click" as its body.
// It stops that business's emails to that address at once
// (docs/plans/email.md, EM-D10). People who tap the email's own link get
// the page at /email/stop, which asks first.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t")
  return (await stopEmails(token))
    ? new Response(null, { status: 204 })
    : new Response(null, { status: 400 })
}
