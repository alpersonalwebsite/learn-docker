# Base image, pinned. `node:lts-alpine` was a moving target: the `lts` tag follows whichever
# Node line is current, so the same Dockerfile built a different image every year. Measured
# today it resolves to Node 24.19 on Alpine 3.24, and it meant something else when these notes
# were written.
#
# An explicit tag is MORE CONSTRAINED, not reproducible, and an earlier version of this comment
# said reproducible, which is wrong. `node:24-alpine3.24` is still mutable: official images are
# rebuilt when their base or packages change, so the same tag resolves to new content over time
# and a rebuild months apart can differ. Only a digest is immutable:
#
#   FROM node:24-alpine3.24@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43
#
# That is what the tag resolved to when this was written. The trade is real: a digest pin needs an
# owner to refresh it, and an unrefreshed digest means missing the security patches the rebuilds
# carry. Tags are used here for readability, which is a deliberate choice for a notes repository
# rather than a claim of reproducibility.
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
# That alone does NOT give you a graceful stop. Linux applies no default signal dispositions to
# PID 1, so node ignores SIGTERM unless the app handles it. Measured, `docker stop` duration and
# the container's exit code:
#
#   CMD ["npm", "start"], no handler        0.70s  exit 1    npm reports SIGTERM as a failure
#   CMD ["node", "index.js"], no handler   10.26s  exit 137  ignored, then SIGKILL
#   CMD ["node", "index.js"] + --init       0.18s  exit 143  tini forwards; still signalled
#   CMD ["node", "index.js"] + handler      0.19s  exit 0    <- this file, plus src/index.js
#
# The gain over `npm start` is NOT speed: 0.70s against 0.19s is not a difference worth claiming,
# and an earlier version of this comment claimed it from second-resolution timing. It is the exit
# code. `npm start` reports a failed exit on every ordinary stop; this form exits 0.
#
# Switching to the exec form WITHOUT the handler in src/index.js is a clear regression: 10s and
# exit 137 instead of 0.7s and exit 1.
CMD ["node", "index.js"]
