# Dockerfile
Instructions for building a docker image.


## Creating your Dockerfile

To take advantage of Docker layer caching (and reduce time when building the docker image), we should always have the instructions that don't often change at the top and those that change frequently, at the bottom.

### FROM (base image for our application)

```Dockerfile
FROM node:24-alpine3.24
```

**Pin it.** `node:lts-alpine` is a moving target: the `lts` tag follows whichever Node line is
current, so the same Dockerfile produces a different image over time and a build that worked last
year can fail today for reasons nothing in your repository explains. Measured, that tag resolves to
Node 24.19 on Alpine 3.24 today. It pointed at a different major when these notes were written in
2022, which is the whole problem: the Dockerfile does not record which.

Pinning is a spectrum, and only the last rung is actually immutable:

| form | fixes | mutable? |
| --- | --- | --- |
| `node:lts-alpine` | nothing much | yes, follows whichever line is LTS |
| `node:24-alpine3.24` | major and distro | **yes** — official images are rebuilt when their base or packages change |
| `node:24.19-alpine3.24` | minor too | **yes**, same reason |
| `node:24-alpine3.24@sha256:...` | the exact image | no |

So an explicit tag is *more constrained* than `lts`, not reproducible. A rebuild months apart can
pull different content from the same tag. Only a digest locks it, and the cost is that a digest needs
an owner to refresh it: an unrefreshed digest means you also miss the security patches those rebuilds
carry, which is the trade rather than a free win.

A pin of any kind also does not protect you from the host changing underneath it.
`00_4_docker-compose.md` has a worked example: `mongo:8.0` stopped working on a newer kernel.

### COPY and ADD (adding files)

**All files**

```Dockerfile
COPY . /app
```

We can ignore some files or directories with `.dockerignore`

.dockerignore
```
node_modules/
```

In this example, not adding the node_modules/ folder will drastically reduce the build context.
However, since we are not adding node_modules/ we have to run `npm install`.

**Some files**

```Dockerfile
COPY package.json index.js /app/
```

If we are using `WORKDIR` we can use a relative path:

```Dockerfile
WORKDIR /app
COPY src .
```

We can also use `ADD`, which additionally fetches a URL and auto-extracts a *local* tar archive.

```Dockerfile
ADD https://example.com/file.ext .
```

```Dockerfile
ADD file.tar.gz .
```

Two caveats, which is why Docker's own guidance is to prefer `COPY` unless you specifically want
one of these behaviours:

- **`ADD` auto-extracts local tar archives but not remote ones**, and it does not extract `.zip`
  at all. `ADD file.zip .` copies the zip; it does not unzip it.
- **A URL fetch is opaque to the build cache** and cannot be checksummed inline, so the usual
  advice is `RUN curl -fsSL <url> -o file && echo "<sha> file" | sha256sum -c` instead, which
  fails the build on a changed or corrupted download.

To reduce times during build, we can COPY two times: one with the files that we are going to use for installing our external dependencies and the other to copy the application files.
Doing this, if something changes in our source code, docker won't re-run `npm install` (or whatever you are using to install your dependencies), and, in consequence, it will use the cached layer.

```Dockerfile
COPY package*.json .
RUN npm install
COPY . .
```

`docker-hello-world/Dockerfile` is the worked example. It previously copied the source *before*
installing, which is the mistake this section warns about, and the effect is measurable: editing one
line of `src/index.js` and rebuilding re-ran `npm install` with the old order, and reports `CACHED`
with the order above.

### RUN (running commands)

```shell
RUN npm install
```

### ENV (setting env variables)

Single:

```shell
ENV NAME1=value
```

Multiple:

```shell
ENV NAME1=value1 \
    NAME2=value2
```

### EXPOSE (documenting the port)

The instruction is `EXPOSE`; there is no `PORT` instruction.

```Dockerfile
EXPOSE 3000
```

And it is weaker than it looks: **`EXPOSE` publishes nothing at all.** It records the port as
image metadata, for people reading the Dockerfile and for `docker run -P`, which publishes every
exposed port to a random host port. Reaching the app still needs `-p 8080:3000` at run time, and
an app with no `EXPOSE` line is just as reachable if you publish its port.

### USER

By default docker runs the application as root, which can be a security concern.
We can create a user with scoped permissions.

In the following example we are creating a group (application) and a new system user (application) in `node:alpine`

```Dockerfile
RUN addgroup application && adduser -S -G application application
USER application
```

The official `node` images already ship an unprivileged `node` user (uid 1000), so on those you can
write `USER node` and skip the `addgroup`/`adduser` entirely. That is what
`docker-hello-world/Dockerfile` does.

**Where you put `USER` matters, though less than I assumed.** The intuition is that switching user
before `WORKDIR` and `RUN npm install` breaks the build, because the later steps cannot write. It
does not: `WORKDIR` creates the directory owned by whatever user is active, so the example below
builds and installs fine. Verified by building it with a real dependency.

What it does change is who owns what, and whether the *running* app can write to its own code
directory. Installing as root and switching user afterwards is the safer default, because the
application then cannot modify the files it is executing:

```Dockerfile
FROM node:24-alpine3.24
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
USER node
CMD ["node", "index.js"]
```

### CMD


`RUN` is used at the `build time` (aka, when building the image) and `CMD` at `run time` (aka, when running the container).

```Dockerfile
CMD ["npm", "start"]

# You can also do the following but it will use a new shell
# CMD npm start
```

This requires the existence of a `start` script on `package.json`

```json
  "scripts": {
    "start" : "node server.js"
  }
```

---

## Putting it together

```Dockerfile
FROM node:24-alpine3.24

WORKDIR /app
RUN mkdir data

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV STAGE=development
EXPOSE 9090

# Switch user last, so the installs above run as root and the app cannot rewrite its own code.
USER node

CMD ["node", "index.js"]
```

Then, we can build the image:

```shell
docker build -t image-name .
```

Changes from the version these notes used to show, and why:

- **`node:alpine` to `node:24-alpine3.24`.** An unpinned tag builds a different image over time.
- **Dependencies copied and installed before the source**, per the caching section above.
- **`npm ci` instead of `npm install`**, because there is a lockfile to honour.
- **`USER` moved to the end.** The old order still built, as noted above, but installing as root
  and dropping privileges last means the running app cannot write to `/app`.
- **`CMD ["node", "index.js"]` instead of `["npm", "start"]`**, with the caveat in the next section:
  on its own that change makes shutdown *worse*, not better.

## Signals, PID 1 and why `docker stop` sometimes takes ten seconds

`docker stop` sends `SIGTERM`, waits ten seconds, then sends `SIGKILL`. Whether you wait out that
grace period depends on something unintuitive: **Linux gives PID 1 no default signal dispositions.**
A normal process is killed by an unhandled `SIGTERM`; PID 1 ignores it.

Measured on `docker-hello-world`, three runs each, with a millisecond timer:

| `CMD` / run | `docker stop` | container exit code |
| --- | --- | --- |
| `["npm", "start"]`, no handler | ~0.70s | **1** — npm logs `npm error signal SIGTERM` and fails |
| `["node", "index.js"]`, no handler | **~10.26s** | **137** (128+9, SIGKILL) |
| `["node", "index.js"]`, no handler, `docker run --init` | ~0.18s | **143** (128+15, SIGTERM) |
| `["node", "index.js"]` + SIGTERM handler | ~0.19s | **0** |

Two things to read out of that, and the second is the one that matters:

**The timing difference between `npm start` and a handled `node` process is negligible** — 0.70s
against 0.19s. An earlier version of this section implied `npm start` was slow to stop, which came
from timing with whole-second resolution and reading 1s against 0s as a difference. It is not one.
npm does forward the signal.

**What actually differs is the exit code.** Stopping the `npm start` container is reported as a
*failure*: exit 1, with `npm error command failed` / `npm error signal SIGTERM` in the logs, on every
ordinary stop. That is what an orchestrator, a `docker wait`, a restart policy or a CI step sees. Only
the app-handled case exits 0.

The 10-second row is the real trap, and it is the state you land in by switching to the exec form
*without* adding a handler: SIGTERM is ignored, Docker waits out the grace period, then SIGKILL, exit
137. `--init` avoids the wait by putting tini at PID 1 to forward the signal, but the process is still
terminated by it rather than exiting cleanly, hence 143.

So the app handles the signal, which is what `docker-hello-world/src/index.js` does:

```js
const server = app.listen(port)
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
```

or you give the container a real init with `docker run --init`, or `init: true` in Compose, which
puts tini at PID 1 to forward signals and reap zombies.

## Multi-stage builds

One Dockerfile, several `FROM` instructions. Each `FROM` starts a new stage, and the final stage is
the image you ship, so anything only needed to *build* the app is left behind.

A TypeScript app needs `typescript` and `@types/*` to compile and none of it to run. Single stage:

```Dockerfile
FROM node:24-alpine3.24
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build
USER node
CMD ["node", "dist/index.js"]
```

The same thing in two stages, naming the first one with `AS build` and copying only its output:

```Dockerfile
FROM node:24-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:24-alpine3.24 AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/index.js"]
```

Built both and measured, same app, same base image:

| | image size |
| --- | --- |
| single stage | 200.2 MB |
| multi stage | 165.9 MB |
| **saved** | **34.2 MB, 17% smaller** |

Both serve the same response. 17% is worth having and it is not the order-of-magnitude cut
multi-stage builds are often advertised with, because the saving is only ever as large as the build
tooling you leave behind: here that is the TypeScript compiler and some type packages. Put a
compiler toolchain in the build stage, or `node-gyp`, or a Go or Rust build, and the gap gets much
wider. Measure it for your own app rather than assuming.

Other things stages are good for:

- `COPY --from=build` copies from a named stage. It also works with an image:
  `COPY --from=nginx:alpine /etc/nginx/nginx.conf .`
- `docker build --target build .` stops at a named stage, which is how you get a test or lint stage
  that CI can run without building the runtime image.
- Stages that nothing depends on are skipped by BuildKit, so an unused stage costs nothing.