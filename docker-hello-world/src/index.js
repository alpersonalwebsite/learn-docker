const express = require('express')
const app = express()
const port = process.env.PORT || 3000

app.get('/', (req, res) => {
  res.send('Hello World!')
})

const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

// Graceful shutdown, and this is load-bearing rather than ceremony.
//
// The Dockerfile runs `node index.js` directly, so node is PID 1. Linux does not apply default
// signal dispositions to PID 1: a signal with no explicit handler is ignored. So without the
// listener below, `docker stop` sends SIGTERM, nothing happens, and Docker waits out its
// 10-second grace period before SIGKILL.
//
// Measured on this app, `docker stop` duration and the container's exit code:
//   CMD ["npm", "start"], no handler        0.70s  exit 1    npm reports SIGTERM as a failure
//   CMD ["node", "index.js"], no handler   10.26s  exit 137  ignored, then SIGKILL
//   CMD ["node", "index.js"] + --init       0.18s  exit 143  tini forwards; still signalled
//   CMD ["node", "index.js"] + this file    0.19s  exit 0
//
// So the exec form alone is not the fix people assume it is, and the win over `npm start` is the
// clean exit 0 rather than any real speed difference. Either the app handles the signal, as here,
// or something like tini has to be PID 1.
// server.close() stops accepting connections and then waits for in-flight requests to finish,
// with no upper bound. So a single slow request outlives Docker's stop timeout (10s by default),
// SIGKILL arrives, and the container exits 137 after all: the handler defeats itself in exactly
// the case it exists for. Measured against a variant with a 30-second route:
//
//   close() with no deadline   10.2s   exit 137   killed mid-request
//   with the deadline below     5.2s   exit 1     forced, and reported as forced
//
// The deadline has to sit below the stop timeout to be the thing that fires first. Exiting 1 on
// that path is deliberate: a shutdown that dropped live requests is not a clean one, and an
// orchestrator should be able to tell the difference.
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5000
// setTimeout stores its delay in a 32-bit signed integer.
const MAX_TIMEOUT_MS = 2147483647

// Validated, because setTimeout coerces anything it cannot use to a 1ms delay rather than
// rejecting it, which turns this guard into an immediate kill: the precise opposite of its job.
// Measured on node 24, with Node's own warnings naming each case:
//
//   SHUTDOWN_TIMEOUT_MS=abc          NaN   -> fires in ~1ms   TimeoutNaNWarning
//   SHUTDOWN_TIMEOUT_MS=-1                 -> fires in ~2ms   TimeoutNegativeWarning
//   SHUTDOWN_TIMEOUT_MS=0                  -> fires in ~2ms
//   SHUTDOWN_TIMEOUT_MS=2147483648         -> fires in ~1ms   TimeoutOverflowWarning
//
// So a typo in an environment variable would drop every in-flight request instantly while still
// looking configured. Out-of-range values fall back to the default and say so.
function shutdownTimeoutMs() {
  const raw = process.env.SHUTDOWN_TIMEOUT_MS
  if (raw === undefined || raw.trim() === '') return DEFAULT_SHUTDOWN_TIMEOUT_MS

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_TIMEOUT_MS) {
    console.error(
      `SHUTDOWN_TIMEOUT_MS=${JSON.stringify(raw)} is not a usable delay ` +
        `(need 1..${MAX_TIMEOUT_MS}); falling back to ${DEFAULT_SHUTDOWN_TIMEOUT_MS}ms`,
    )
    return DEFAULT_SHUTDOWN_TIMEOUT_MS
  }
  return parsed
}

const SHUTDOWN_TIMEOUT_MS = shutdownTimeoutMs()
let shuttingDown = false

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    // Idempotent: Docker sends one signal, but a human pressing Ctrl-C twice, or a supervisor
    // retrying, would otherwise start a second shutdown and race the first.
    if (shuttingDown) return
    shuttingDown = true
    console.log(`${signal} received, closing server`)

    const forceExit = setTimeout(() => {
      console.error(`shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms, closing connections`)
      server.closeAllConnections()
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)
    // Do not let the timer itself hold the process open once close() wins the race.
    forceExit.unref()

    server.close(() => {
      clearTimeout(forceExit)
      process.exit(0)
    })
  })
}
