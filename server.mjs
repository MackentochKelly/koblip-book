// Custom server: Next.js plus the live-hearing WebSocket relay on one port.
// `npm run dev` / `npm start` run this instead of the Next CLI. Follows the
// bundled Next.js custom-server doc: next({ dev, hostname, port }), one http
// server, every request to Next's handler. No bundler option: the default is
// Turbopack when nothing is configured (verified in
// node_modules/next/dist/lib/bundler.js and dist/server/next.js), the same
// default `next dev` uses today.
import { createServer } from "node:http"
import next from "next"
import { WebSocket, WebSocketServer } from "ws"
import { relayVoice } from "./server/voice-relay.mjs"

const port = parseInt(process.env.PORT || "3000", 10)
const hostname = process.env.HOSTNAME || "localhost"
const dev = process.env.NODE_ENV !== "production"

const app = next({ dev, hostname, port })
await app.prepare()
const handle = app.getRequestHandler()
const handleUpgrade = app.getUpgradeHandler()

const wss = new WebSocketServer({ noServer: true })

function rejectUpgrade(socket, status, text) {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\n\r\n`)
  socket.destroy()
}

async function handleVoiceUpgrade(request, socket, head) {
  // Same origin only: the Origin host must equal the Host header.
  let originHost = null
  try {
    originHost =
      request.headers.origin == null
        ? null
        : new URL(request.headers.origin).host
  } catch {
    originHost = null
  }
  if (originHost === null || originHost !== request.headers.host) {
    rejectUpgrade(socket, 403, "Forbidden")
    return
  }

  // Owner checks stay inside Next: the internal check route sees the
  // request's cookie. Same hostname and port this server listens on.
  const url = new URL(request.url || "/", "http://x")
  let check = null
  try {
    check = await fetch(
      `http://${hostname}:${port}/api/voice/check${url.search}`,
      { headers: request.headers.cookie ? { cookie: request.headers.cookie } : {} }
    )
  } catch {
    rejectUpgrade(socket, 503, "Service Unavailable")
    return
  }
  if (check.status !== 200) {
    rejectUpgrade(socket, check.status, "Rejected")
    return
  }

  const apiKey = process.env.MODEL_API_KEY
  if (!apiKey) {
    rejectUpgrade(socket, 503, "Service Unavailable")
    return
  }
  const settings = await check.json()
  wss.handleUpgrade(request, socket, head, (client) => {
    relayVoice({
      client,
      openUpstream: (target) => new WebSocket(target),
      settings,
      apiKey,
    })
  })
}

const server = createServer((req, res) => handle(req, res))
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "/", "http://x")
  if (url.pathname === "/api/voice/listen") {
    handleVoiceUpgrade(request, socket, head)
    return
  }
  handleUpgrade(request, socket, head)
})
server.listen(port, hostname, () => {
  console.log(`> Server listening at http://${hostname}:${port}`)
})
