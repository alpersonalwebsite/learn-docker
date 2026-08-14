# Base image, pinned. `node:lts-alpine` was a moving target: the `lts` tag follows whichever
# Node line is current, so the same Dockerfile built a different image every year. Measured
# today it resolves to Node 24.19 on Alpine 3.24, and it meant something else when these notes
# were written. An explicit tag is reproducible; `node:24-alpine3.24@sha256:...` is stricter
# still, at the cost of a manual bump for every patch release.
FROM node:24-alpine3.24

WORKDIR /app

# Dependencies BEFORE the source, which is what 00_2_Dockerfile.md tells you to do and what
# this file previously did not. Layer caching keys on the files each step copies, so with the
# source copied first, editing one line of index.js invalidated `npm install`.
#
# Measured on this project by editing src/index.js and rebuilding:
#   source copied first (old order)  ->  RUN npm install re-runs
#   dependencies first (this order)  ->  RUN npm install is CACHED
COPY package.json package-lock.json ./

# `npm ci`, not `npm install`. There is a committed lockfile, and ci installs exactly what it
# pins and fails if package.json and the lockfile disagree, where install may quietly resolve
# something else and rewrite the lockfile. --omit=dev because nothing here needs devDependencies
# at runtime.
RUN npm ci --omit=dev

COPY src .

# Documentation only. EXPOSE publishes nothing: it records the port for readers and for tools
# like `docker run -P`. Reaching the app still requires `-p 8080:3000` at run time.
EXPOSE 3000

# Run as the unprivileged `node` user, which the official image already provides (uid 1000).
# The container previously ran as root, while 00_2_Dockerfile.md spends a section explaining
# why that is a concern. USER comes after the installs so those still write as root; the app
# itself needs no write access to /app.
USER node

# Exec form, calling node directly rather than through npm, so there is one process instead of
# two and node is PID 1.
#
# That alone does NOT give you a graceful stop, which is the opposite of what I first assumed
# here. Linux applies no default signal dispositions to PID 1, so node ignores SIGTERM unless
# the app handles it. Measured, time for `docker stop` to return:
#
#   CMD ["npm", "start"]                     1s   npm installs its own handlers
#   CMD ["node", "index.js"], no handler    10s   SIGTERM ignored, then SIGKILL
#   CMD ["node", "index.js"], with handler   0s   <- this file, plus src/index.js
#   CMD ["node", "index.js"] + --init        0s   tini is PID 1 and forwards
#
# src/index.js installs the SIGTERM and SIGINT listeners that make this form correct. Switching
# to the exec form WITHOUT them is a regression from the original `npm start`.
CMD ["node", "index.js"]
