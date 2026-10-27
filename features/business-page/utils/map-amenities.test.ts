import { expect, test } from "vitest"
import { mapAmenities } from "./map-amenities"

test("maps each flag to its amenity in order", () => {
  expect(
    mapAmenities({
      accessibilityOptions: { wheelchairAccessibleEntrance: true },
      parkingOptions: { freeParkingLot: true },
      paymentOptions: { acceptsCreditCards: true, acceptsNfc: true },
      allowsDogs: true,
      goodForChildren: true,
      restroom: true,
    })
  ).toEqual([
    "wheelchair",
    "parking",
    "pets",
    "kids",
    "restroom",
    "cards",
    "nfc",
  ])
})

test("needs only one true value in an options group", () => {
  expect(
    mapAmenities({
      accessibilityOptions: {
        wheelchairAccessibleParking: false,
        wheelchairAccessibleSeating: true,
      },
    })
  ).toEqual(["wheelchair"])
  expect(mapAmenities({ paymentOptions: { acceptsDebitCards: true } })).toEqual(
    ["cards"]
  )
})

test("cash-only wins over cards and NFC", () => {
  expect(
    mapAmenities({
      paymentOptions: {
        acceptsCashOnly: true,
        acceptsCreditCards: true,
        acceptsDebitCards: true,
        acceptsNfc: true,
      },
    })
  ).toEqual(["cash_only"])
})

test("missing fields map to no amenities", () => {
  expect(mapAmenities({})).toEqual([])
  expect(
    mapAmenities({
      accessibilityOptions: { wheelchairAccessibleEntrance: false },
      parkingOptions: {},
      paymentOptions: {},
      allowsDogs: false,
    })
  ).toEqual([])
})
