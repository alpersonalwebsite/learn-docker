const express = require('express')

const app = express()
const port = process.env.PORT || 3000

// Again a service name, not localhost. Inside the container, `localhost` is the container itself,
// which is the single most common mistake when wiring compose services together.
const backendUrl = process.env.BACKEND_URL || 'http://backend:8080'

app.get('/healthz', (req, res) => res.json({ ok: true }))

app.get('/', async (req, res) => {
  try {
    // Two things fetch does not do for you:
    //
    // It does not reject on an HTTP error. A 500 from the backend is a resolved promise, so
    // without the ok check below the error body is parsed and rendered as if it were a success.
    //
    // It does not time out. The default is to wait indefinitely, so a backend that accepts the
    // connection and then stalls holds this request open too, and the stall propagates to
    // whoever called the frontend. AbortSignal.timeout bounds it.
    const upstream = await fetch(`${backendUrl}/api/hello`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!upstream.ok) {
      res
        .status(502)
        .send(`<h1>Backend error</h1><pre>${upstream.status} ${upstream.statusText}</pre>`)
      return
    }
    const body = await upstream.json()
    res.send(`<h1>Hello World!</h1><pre>${JSON.stringify(body, null, 2)}</pre>`)
  } catch (err) {
    // A timeout arrives here as TimeoutError, which is worth distinguishing from a refused
    // connection when reading the logs.
    const reason = err.name === 'TimeoutError' ? 'backend timed out' : err.message
    res.status(502).send(`<h1>Backend unreachable</h1><pre>${reason}</pre>`)
  }
})

const server = app.listen(port, () => console.log(`frontend listening on ${port}`))
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
