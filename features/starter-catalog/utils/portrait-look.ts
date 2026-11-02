// How each team photo's person looks, picked by code so the AI draws
// different people in one go. With no look in the prompt, Muse Image draws
// the same default face for teammates who share a gender.
// Every row differs from every other in age, hair and detail, so any team
// of up to PORTRAIT_LOOKS.length members has no two alike. Gender comes
// from the name; these words fit anyone.
export const PORTRAIT_LOOKS = [
  "in their mid-20s, short straight hair, clear skin",
  "in their late 30s, curly hair, round glasses",
  "in their early 50s, wavy hair with some grey, a few smile lines",
  "in their early 30s, long hair tied back, freckles",
  "in their mid-40s, cropped dark hair, thin-framed glasses",
  "in their late 20s, shoulder-length hair, a light tan",
] as const

// The look for the member at this place in the team list.
export function portraitLook(position: number): string {
  const index = Math.abs(Math.trunc(position)) % PORTRAIT_LOOKS.length
  return PORTRAIT_LOOKS[index]
}
