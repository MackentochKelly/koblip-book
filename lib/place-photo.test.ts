import { expect, test } from "vitest"

import { placePhotoSize, placePhotoUrl, thumbnailUrl } from "./place-photo"

const NAME = "places/abc/photos/xyz"

test("placePhotoUrl asks for the full size by default", () => {
  expect(placePhotoUrl(NAME)).toBe(
    "/api/place-photo?name=places%2Fabc%2Fphotos%2Fxyz"
  )
  expect(placePhotoUrl(NAME, "thumb")).toBe(
    "/api/place-photo?name=places%2Fabc%2Fphotos%2Fxyz&size=thumb"
  )
})

test("placePhotoSize only knows thumb", () => {
  expect(placePhotoSize("thumb")).toBe("thumb")
  expect(placePhotoSize("huge")).toBe("full")
  expect(placePhotoSize(null)).toBe("full")
})

test("thumbnailUrl shrinks Google photos only", () => {
  expect(thumbnailUrl(placePhotoUrl(NAME))).toBe(placePhotoUrl(NAME, "thumb"))
  expect(thumbnailUrl(placePhotoUrl(NAME, "thumb"))).toBe(
    placePhotoUrl(NAME, "thumb")
  )
  expect(thumbnailUrl("/uploads/photo.webp")).toBe("/uploads/photo.webp")
})
