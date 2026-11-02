import { GET_STARTED_ID } from "@/components/home-section-title"
import { useReducedMotion } from "@/hooks/use-theme-colors"

// Scrolls up to the home page's search box and puts the cursor in it.
export function useFindBusiness() {
  const still = useReducedMotion()
  return function findBusiness() {
    const target = document.getElementById(GET_STARTED_ID)
    if (!target) return
    target.scrollIntoView({
      behavior: still ? "auto" : "smooth",
      block: "center",
    })
    target.querySelector("input")?.focus({ preventScroll: true })
  }
}
