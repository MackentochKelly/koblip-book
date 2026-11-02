module.exports = {
  apps: [
    {
      name: process.env.BOOK_PM2_NAME || "koblip-book",
      script: "server.mjs",
      exec_mode: "fork",
      instances: 1,
      // Allow running requests and after() work to drain. The server's
      // own 28 s limit exits before PM2's 30 s forced kill.
      kill_timeout: 30_000,
      env: {
        NODE_ENV: "production",
        PORT: process.env.BOOK_PORT || 3100,
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
}
