# Dockerfile
Instructions for building a docker image.

<!-- 
  TODO:
    Docker multi-stage builds
-->

## Creating your Dockerfile

To take advantage of Docker layer caching (and reduce time when building the docker image), we should always have the instructions that don't often change at the top, and those that change frequently, at the bottom.

### FROM (base image for our application)

```Dockerfile
FROM node:lts-alpine
```

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

We can also use `ADD` which will allow use to copy a file from a URL and/or uncompress a compressed file and add it to the directory.

```Dockerfile
ADD your-full-url/file.ext .
```

```Dockerfile
ADD file.zip .
```

To reduce times during build, we can COPY two times: one with the files that we are going to use for installing our external dependencies and the other to copy the application files.
Doing this, if something changes in our source code, docker won't re-run `npm install` (or whatever you are using to install your dependencies), and, in consequence, it will use the cached layer.

```Dockerfile
COPY package*.json .
RUN npm install
COPY . .
```

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

### PORT (exposing the port of the container)

Remember, it exposes the port of the container NOT the host

```shell
EXPOSE 3000
```

### USER

Buy default docker runs the application using the root user, what can be a security concern.
We can create a user with scoped permissions.

In the following example we are creating a group (application) and a new system user (application) in `node:alpine`

```
RUN addgroup application && adduser -S -G application application
USER application
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


```Dockerfile
FROM node:alpine
RUN addgroup application && adduser -S -G application application
USER application
WORKDIR /app
RUN mkdir data
COPY . .
RUN npm install
ENV STAGE=development
EXPOSE 9090
CMD ["npm", "start"]
```

Then, we can build the image:

```shell
docker build -t image-name .
```