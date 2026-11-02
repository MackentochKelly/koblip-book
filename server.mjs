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
import { handleVoiceUpgrade } from "./server/voice-upgrade.mjs"
import { createVoiceSlots } from "./server/voice-slots.mjs"
import { createShutdownHandler } from "./server/shutdown.mjs"
import { redirectDevAddress } from "./server/dev-address.mjs"

const port = parseInt(process.env.PORT || "3000", 10)
const hostname = process.env.HOSTNAME || "localhost"
const dev = process.env.NODE_ENV !== "production"

const app = next({ dev, hostname, port })
await app.prepare()
const handle = app.getRequestHandler()
const handleUpgrade = app.getUpgradeHandler()

const wss = new WebSocketServer({ noServer: true })
// Open live voice sessions per owner (each is a paid upstream session).
const voiceSlots = createVoiceSlots()

// Same hostname and port this server listens on.
const voiceCheckUrl = `http://${hostname}:${port}/api/voice/check`

function startVoiceUpgrade(request, socket, head) {
  void handleVoiceUpgrade({
    request,
    socket,
    checkUrl: voiceCheckUrl,
    apiKey: process.env.MODEL_API_KEY,
    slots: voiceSlots,
    accept: (settings) =>
      wss.handleUpgrade(request, socket, head, (client) => {
        relayVoice({
          client,
          openUpstream: (target) => new WebSocket(target),
          settings,
          apiKey: process.env.MODEL_API_KEY,
        })
      }),
  })
}

const server = createServer((req, res) => {
  if (dev && redirectDevAddress(req, res, dev, process.env.BETTER_AUTH_URL)) return
  return handle(req, res)
})
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "/", "http://x")
  if (url.pathname === "/api/voice/listen") {
    startVoiceUpgrade(request, socket, head)
    return
  }
  handleUpgrade(request, socket, head)
})
server.listen(port, hostname, () => {
  const shutdown = createShutdownHandler({ server, app, wss, dev })
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
  console.log(`> Server listening at http://${hostname}:${port}`)
})
