# node, not alpine. The version of these notes that shipped before this directory existed used
# `FROM alpine:3.14` and then `RUN npm install`, which cannot work: alpine carries no Node and no
# npm, so the build failed with exit code 127. Verified by building it.
FROM node:24-alpine3.24

WORKDIR /app

# Manifests first, so editing the source does not invalidate the install layer.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src .

EXPOSE 3000

USER node

# See src/index.js: node is PID 1, and PID 1 receives no default signal handling, so the app
# installs its own SIGTERM listener. Without it `docker compose down` takes the full grace period.
CMD ["node", "index.js"]
