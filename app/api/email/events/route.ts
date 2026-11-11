import {
  applySesEvent,
  confirmSubscription,
  verifySnsMessage,
} from "@/lib/email-events"

// Where Amazon SNS posts Amazon SES's events for Book's emails
// (docs/plans/email.md, EM-D3). Each message is checked against Amazon's
// signature and Book's topic before anything is done with it; 403 for one
// that fails. A 5xx makes SNS try again.
export async function POST(request: Request) {
  let body: unknown
  try {
    body = JSON.parse(await request.text())
  } catch {
    return new Response(null, { status: 400 })
  }
  const message = await verifySnsMessage(body)
  if (!message) return new Response(null, { status: 403 })

  if (message.Type === "SubscriptionConfirmation") {
    const confirmed = await confirmSubscription(message)
    return new Response(null, { status: confirmed ? 204 : 502 })
  }
  if (message.Type === "Notification") await applySesEvent(message.Message)
  return new Response(null, { status: 204 })
}
