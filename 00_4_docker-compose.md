# Docker Compose

Running a multi-container application from one file, instead of a pile of `docker run` commands.

There is a working example in [`docker-compose/`](docker-compose/): a frontend, a backend and a
MongoDB database. It starts with one command, and everything in this file was checked against it.

## Compose V2, and the `docker-compose` command

```shell
docker compose version
```

**`docker compose` (a space) is V2.** The old `docker-compose` (a hyphen) is the Python V1
implementation, which reached end of life in July 2023; V2 ships as a plugin with Docker Desktop and
current Docker Engine. The commands below use V2. If `docker compose version` fails but
`docker-compose -v` works, you are on V1 and the `depends_on: condition:` syntax used here will not
be available.

## Running it

```shell
cd docker-compose

# build images where a service has `build:`, then start everything
docker compose up -d --build

# what is running, and whether healthchecks pass
docker compose ps

# logs, all services or one
docker compose logs -f
docker compose logs -f backend

# stop and remove the containers and network, KEEPING named volumes
docker compose down

# ...and remove the volumes too, discarding the database
docker compose down -v
```

`docker compose build` builds without starting.

Once it is up, `http://localhost:3000` serves the frontend, which calls the backend, which reads and
writes Mongo:

```json
{
  "message": "Hello from the backend",
  "visitsBefore": 3
}
```

## The compose file

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - 3000:3000
    environment:
      BACKEND_URL: http://backend:8080
    depends_on:
      backend:
        condition: service_healthy

  backend:
    build: ./backend
    environment:
      DB_URL: mongodb://database/my-app
    depends_on:
      database:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 3s
      timeout: 3s
      retries: 10
      start_period: 5s

  database:
    image: mongo:8.2
    volumes:
      - my-app:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 3s
      timeout: 5s
      retries: 10
      start_period: 5s

volumes:
  my-app:
```

### No `version:` key

It was required by V1 and is obsolete now. Leaving it in produces:

```text
the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion
```

The file is named `compose.yaml`, which V2 prefers; `docker-compose.yml` still works.

### Service names are hostnames

Compose puts every service on a project network where the service name resolves. So the backend
reaches Mongo at `mongodb://database/my-app` and the frontend reaches the backend at
`http://backend:8080`.

**Inside a container, `localhost` is that container.** Pointing the frontend at
`http://localhost:8080` is the most common way to get a connection refused here.

### `depends_on` waits for *start*, not for *ready*

This is the classic Compose race. Plain `depends_on: [database]` only waits for the container to be
started, and Mongo takes a second or two after that before it accepts connections, so the backend
connects too early and dies.

`condition: service_healthy` waits for the healthcheck instead, which is why both the database and the
backend define one. With those in place `docker compose up` reports `database Healthy` and then
`backend Healthy` before the frontend starts.

The alternative, if you do not want healthchecks, is to make the client retry: the backend here also
answers 503 rather than crashing if a query fails, since an unavailable database is a normal state for
the first moments of a startup.

### Do not publish the database

The earlier version of this file mapped `27017:27017`, which puts an unauthenticated MongoDB on your
machine's network. Nothing needs it: the backend reaches the database over the project network by
name. Publish only what you actually browse to, here the frontend's 3000.

### Named volumes

`my-app:/data/db` mounts a named volume at Mongo's data directory, so the data survives the container.
Verified: with `docker compose down` and `up`, the visit count carried over (5 before, 7 after);
with `down -v` it reset.

## The service Dockerfiles

Both are in [`docker-compose/`](docker-compose/). They follow the practices in
`00_2_Dockerfile.md`: pinned base, manifests copied before the source, `npm ci`, a non-root `USER`,
and an app that handles `SIGTERM` so `docker compose down` returns immediately.

```dockerfile
FROM node:24-alpine3.24

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src .

EXPOSE 8080

USER node

CMD ["node", "index.js"]
```

> **The version of these Dockerfiles in these notes could not build.** They read `FROM alpine:3.14`
> followed by `RUN npm install`, and plain alpine carries neither Node nor npm, so the build failed
> with `exit code: 127`. Confirmed with
> `docker run --rm alpine:3.14 command -v npm`, which finds nothing. A Node base image is required,
> or you install Node in the image yourself.

## What changed in this file, and why

Nothing here could be run before, which is how three defects survived in nine lines of YAML.

- **`depends_on: db` referenced a service that did not exist**, the service being named `database`.
  That is a hard failure, not a warning: `docker compose config` exits 1 with
  `service "backend" depends on undefined service "db": invalid compose project`.
- **Both Dockerfiles used `FROM alpine:3.14` with `npm install`** and could not build.
- **`version: "3.9"`** is obsolete and warns.
- **The database port was published** to the host.
- **`docker-compose` V1** throughout, which is end of life.
- **`mongo` was unpinned.** It is `mongo:8.2` now, and specifically not `8.0`, which refuses to start
  on Linux kernel 6.19 or newer: `MongoDB cannot start: Linux kernel versions 6.19 and newer has a
  known incompatibility with this version of MongoDB` (SERVER-121912). The Docker VM used to check
  these notes runs 7.0.14, so 8.0 exits 1 and 8.2 starts. A pin stops surprise upgrades; it does not
  stop the host moving underneath the pin.
- **`depends_on` had no readiness condition**, so the stack raced its own database.
- The Dockerfile examples were fenced as `yml`, and there was an empty `##` heading and two empty
  HTML comments.
