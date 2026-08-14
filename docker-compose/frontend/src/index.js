const express = require('express')

const app = express()
const port = process.env.PORT || 3000

// Again a service name, not localhost. Inside the container, `localhost` is the container itself,
// which is the single most common mistake when wiring compose services together.
const backendUrl = process.env.BACKEND_URL || 'http://backend:8080'

app.get('/healthz', (req, res) => res.json({ ok: true }))

app.get('/', async (req, res) => {
  try {
    const upstream = await fetch(`${backendUrl}/api/hello`)
    const body = await upstream.json()
    res.send(`<h1>Hello World!</h1><pre>${JSON.stringify(body, null, 2)}</pre>`)
  } catch (err) {
    res.status(502).send(`<h1>Backend unreachable</h1><pre>${err.message}</pre>`)
  }
})

const server = app.listen(port, () => console.log(`frontend listening on ${port}`))
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
