// Phone photos are often 4000px and several MB. Before upload, a big photo
// is drawn smaller in the browser and saved as JPEG, so it stays well under
// the upload limit. If the browser cannot read it, the file goes as it is
// and the server says what is wrong.
const MAX_SIDE = 1600
const QUALITY = 0.85
const SMALL_BYTES = 1024 * 1024

export async function resizeImage(file: File): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size <= SMALL_BYTES) {
    bitmap.close()
    return file
  }
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY)
  )
  if (!blob) return file
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
    type: "image/jpeg",
  })
}
