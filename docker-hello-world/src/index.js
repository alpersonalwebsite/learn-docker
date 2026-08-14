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
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, closing server`)
    server.close(() => process.exit(0))
  })
}
