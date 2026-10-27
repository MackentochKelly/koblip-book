import { readPhoto } from "@/lib/uploads"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params
  const photo = await readPhoto(file)
  if (!photo) {
    return new Response("Not found", { status: 404 })
  }
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
