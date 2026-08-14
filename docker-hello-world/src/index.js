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
// Measured on this app, time for `docker stop` to return:
//   CMD ["npm", "start"]                       1s   (npm installs its own handlers)
//   CMD ["node", "index.js"], no handler      10s   (SIGTERM ignored, then killed)
//   CMD ["node", "index.js"], with handler     0s
//   CMD ["node", "index.js"] + docker --init   0s   (tini becomes PID 1 and forwards)
//
// So the exec form alone is not the fix people assume it is. Either the app handles the signal,
// as here, or something like tini has to be PID 1.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, closing server`)
    server.close(() => process.exit(0))
  })
}
