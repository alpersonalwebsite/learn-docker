const express = require('express')
const { MongoClient } = require('mongodb')

const app = express()
const port = process.env.PORT || 8080

// Supplied by compose. The host is the SERVICE NAME, `database`, which compose resolves on the
// project network. There is no need to publish the database port to the host for this to work.
const dbUrl = process.env.DB_URL || 'mongodb://database/my-app'

const client = new MongoClient(dbUrl, { serverSelectionTimeoutMS: 5000 })
let visits

app.get('/healthz', (req, res) => res.json({ ok: true }))

app.get('/api/hello', async (req, res) => {
  try {
    const count = await visits.countDocuments()
    await visits.insertOne({ at: new Date() })
    res.json({ message: 'Hello from the backend', visitsBefore: count })
  } catch (err) {
    // Answer 503 rather than crashing: a database that is up but not yet accepting
    // connections is the normal state for the first second or two of `compose up`.
    res.status(503).json({ error: 'database unavailable', detail: err.name })
  }
})

async function start() {
  await client.connect()
  visits = client.db('my-app').collection('visits')
  const server = app.listen(port, () => console.log(`backend listening on ${port}`))
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => server.close(() => client.close().then(() => process.exit(0))))
  }
}

start().catch((err) => {
  console.error('failed to start:', err.message)
  process.exit(1)
})
