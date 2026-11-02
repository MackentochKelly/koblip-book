import { WebSocket } from "ws"

// Leave time for our exit before PM2's 30 s kill timeout.
export const SHUTDOWN_LIMIT_MS = 28_000

// Like Next's start-server cleanup: finish requests before closing Next,
// so any after() work those requests schedule is included in the drain.
export function createShutdownHandler({
  server,
  app,
  wss,
  dev,
  limitMs = SHUTDOWN_LIMIT_MS,
  logger = { error: (...args) => console.error(...args) },
  exit = /** @type {(code: number) => void} */ ((code) => process.exit(code)),
}) {
  let started = false
  return async (signal) => {
    if (started) return
    started = true
    const code = signal === "SIGINT" ? 130 : 143
    let exited = false
    const finish = () => {
      if (exited) return
      exited = true
      clearTimeout(timer)
      exit(code)
    }
    const timer = setTimeout(() => {
      logger.error(
        `Shutdown reached ${limitMs} ms; unfinished work was cut off.`
      )
      finish()
    }, limitMs)
    timer.unref()

    // A failed step must not prevent the other cleanup or the final exit.
    const attempt = (work) => {
      try {
        work()
      } catch (error) {
        logger.error("Shutdown failed:", error)
      }
    }
    try {
      await new Promise((resolve) => {
        try {
          server.close((error) => {
            if (error) logger.error("Shutdown failed:", error)
            resolve()
          })
        } catch (error) {
          logger.error("Shutdown failed:", error)
          resolve()
        }
        attempt(() => server.closeIdleConnections())
        if (dev) attempt(() => server.closeAllConnections())
        // HTTP's close does not close upgraded voice sockets.
        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN) {
            attempt(() => client.close(1012))
          }
        }
      })
      await app.close()
    } catch (error) {
      logger.error("Shutdown failed:", error)
    } finally {
      finish()
    }
  }
}
