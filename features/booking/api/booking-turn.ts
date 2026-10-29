import "server-only"
import { runInTurn } from "@/lib/run-in-turn"

// Every booking for one business (by a customer, the owner or the
// assistant) checks the free times and saves in turn, so two people can
// never both get the last free time. Nothing stays open in the database
// while it waits, so other saves keep working (lib/db/save-all.ts).
export function inBookingTurn<T>(
  businessId: string,
  task: () => Promise<T>
): Promise<T> {
  return runInTurn(`booking:${businessId}`, task)
}
