export function isBookable(input: {
  status: string | null
  servicesCount: number
  hoursCount: number
}): boolean {
  return (
    input.status !== "closed" &&
    input.status !== "temporarily_closed" &&
    input.servicesCount >= 1 &&
    input.hoursCount >= 1
  )
}
