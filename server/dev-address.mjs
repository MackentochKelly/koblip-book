// One dev server answers on several names, while sessions, Google's state
// cookie and the auth origin check all belong to BETTER_AUTH_URL.
export function devAddress(host, path, authUrl) {
  if (!host || !authUrl || !path.startsWith("/")) return null
  if (
    !/^(localhost|127\.0\.0\.1|\[::1\]|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+localhost)(?::[0-9]+)?$/i.test(
      host
    )
  ) {
    return null
  }
  try {
    const canonical = new URL(authUrl)
    if (canonical.protocol !== "http:" && canonical.protocol !== "https:")
      return null
    const requested = new URL(`${canonical.protocol}//${host}`)
    if (requested.port !== canonical.port || requested.host === canonical.host)
      return null
    return `${canonical.origin}${path}`
  } catch {
    return null
  }
}

// This must run before Next: Proxy treats 127.0.0.1, [::1] and localhost
// as one host, so a redirect between them there becomes a relative loop.
export function redirectDevAddress(request, response, dev, authUrl) {
  if (!dev || (request.method !== "GET" && request.method !== "HEAD"))
    return false
  // Pages only. The voice check calls this server on its own address with
  // the visitor's cookie, which a redirect to another host would drop.
  if (request.url === "/api" || request.url.startsWith("/api/")) return false
  const address = devAddress(request.headers.host, request.url, authUrl)
  if (!address) return false
  response.writeHead(307, { Location: address })
  response.end()
  return true
}
