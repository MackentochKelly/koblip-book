import { proofNameFor } from "@/lib/payment-proof-access"
import { readProof } from "@/lib/payment-proofs"

// A booking's payment picture, only for the people allowed to see it
// (lib/payment-proof-access.ts). Checked on every request and never kept
// by a browser or a proxy: it is someone's bank screenshot.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params
  const bytes = await readProof(await proofNameFor(bookingId))
  if (!bytes) {
    return new Response("Not found", { status: 404 })
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
