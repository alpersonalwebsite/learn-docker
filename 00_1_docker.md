# Docker

## Installing docker

Go to https://docs.docker.com/get-started/get-docker/ and install `Docker Desktop` (macOS, Windows,
Linux) or `Docker Engine` (Linux, no desktop app).

`Docker Toolbox`, which earlier versions of these notes suggested for older systems, is **retired**:
`docs.docker.com/toolbox/` now redirects to `docs.docker.com/retired/`. It was the boot2docker-based
predecessor to Docker Desktop and should not be used for anything new.

After installation, run `docker version`.

Sample output, recorded on the original run in 2021 and left as-is; yours will differ:

```shell
Client: Docker Engine - Community
 Cloud integration: 1.0.12
 Version:           20.10.5
 API version:       1.41
 Go version:        go1.13.15
 Git commit:        55c4c88
 Built:             Tue Mar  2 20:13:00 2021
 OS/Arch:           darwin/amd64
 Context:           mycontext
 Experimental:      true

Server: Docker Engine - Community
 Engine:
  Version:          20.10.5
  API version:      1.41 (minimum version 1.12)
  Go version:       go1.13.15
  Git commit:       363e9a8
  Built:            Tue Mar  2 20:15:47 2021
  OS/Arch:          linux/amd64
  Experimental:     false
 containerd:
  Version:          1.4.4
  GitCommit:        05f951a3781f4f2c1911b05e61c160e9c30eaa8e
 runc:
  Version:          1.0.0-rc93
  GitCommit:        12644e614e25b05da6fd08a38ffa0cfe1903fdec
 docker-init:
  Version:          0.19.0
  GitCommit:        de40ad0
```

## Sample `hello-world application`

We are going to `dockerized a basic Express application`:

### Create the application

```shell
cd docker-hello-world
npm ci
```

`npm ci` rather than `npm install`, since a lockfile is committed: it installs exactly what the
lockfile pins and fails if `package.json` disagrees with it.

### Add the Dockerfile

Dockerfile

```Dockerfile
FROM node:24-alpine3.24

WORKDIR /app

# Manifests first, then install, then the source: editing src/ must not invalidate the install layer.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src .

# Metadata only. EXPOSE publishes nothing; -p at run time does.
EXPOSE 3000

# Unprivileged user the official image provides.
USER node

# See the signals section in 00_2_Dockerfile.md: src/index.js handles SIGTERM, which is what makes
# this form stop promptly.
CMD ["node", "index.js"]
```

The committed file at [`docker-hello-world/Dockerfile`](docker-hello-world/Dockerfile) carries the
full reasoning for each line. Earlier versions of these notes showed `FROM node:lts-alpine`, copied
the source before installing, ran as root and used `CMD ["npm", "start"]`; `00_2_Dockerfile.md`
explains what each of those costs.

### Build and tag docker image

```shell
docker build -t docker-hello-world .
```

**Tagging an image after building it**

```shell
docker image tag docker-hello-world:latest docker-hello-world:1
```

If we want to keep `latest` as the real `latest` build when we are building with a different tag we should do the following:

```shell
docker build -t docker-hello-world:3 .

docker image tag docker-hello-world:3 docker-hello-world:latest
```

### Running the container

```shell
docker run -p 8080:3000 docker-hello-world
```

#### Test

```shell
curl -i localhost:8080
```

Output:

```shell
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: text/html; charset=utf-8
Content-Length: 12
ETag: W/"c-Lve95gjOVATpfV8EL5X4nxwjKHE"
Date: Tue, 16 Aug 2022 16:19:37 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

### Other useful commands

**Listing docker images**

```shell
docker image ls
```

Sample output:
```
REPOSITORY                                                      TAG             IMAGE ID       CREATED              SIZE
docker-hello-world                                              latest          22c6c6f3e99f   About a minute ago   111MB
```

**Searching for images**

```shell
docker search term
```

Sample output for `nginx`

```shell
NAME                                              DESCRIPTION                                     STARS     OFFICIAL   AUTOMATED
nginx                                             Official build of Nginx.                        17264     [OK]       
linuxserver/nginx                                 An Nginx container, brought to you by LinuxS…   173                  
bitnami/nginx                                     Bitnami nginx Docker Image                      139                  [OK]
ubuntu/nginx                                      Nginx, a high-performance reverse proxy & we…   56                   
bitnami/nginx-ingress-controller                  Bitnami Docker Image for NGINX Ingress Contr…   19                   [OK]
rancher/nginx-ingress-controller                                                                  10                   
webdevops/nginx                                   Nginx container                                 9                    [OK]
```

**Show the history of an image**

```shell
docker history node:alpine
```

Sample output:

```shell
IMAGE          CREATED         CREATED BY                                      SIZE      COMMENT
72eea7c426fc   22 months ago   /bin/sh -c #(nop)  CMD ["node"]                 0B        
<missing>      22 months ago   /bin/sh -c #(nop)  ENTRYPOINT ["docker-entry…   0B        
<missing>      22 months ago   /bin/sh -c #(nop) COPY file:238737301d473041…   116B      
<missing>      22 months ago   /bin/sh -c apk add --no-cache --virtual .bui…   7.62MB    
<missing>      22 months ago   /bin/sh -c #(nop)  ENV YARN_VERSION=1.22.4      0B        
<missing>      22 months ago   /bin/sh -c addgroup -g 1000 node     && addu…   104MB     
<missing>      22 months ago   /bin/sh -c #(nop)  ENV NODE_VERSION=14.3.0      0B        
<missing>      23 months ago   /bin/sh -c #(nop)  CMD ["/bin/sh"]              0B        
<missing>      23 months ago   /bin/sh -c #(nop) ADD file:b91adb67b670d3a6f…   5.61MB 
```

**Deleting dangling images**

```shell
docker image prune
```

**Deleting images**

```shell
# Remember to delete first the container
# docker container rm docker-hello-world

docker image rm docker-hello-world
```

**Saving image into a compressed file**

```shell
docker image save -o docker-hello-world.tar docker-hello-world:1
```

(`:1` because that is the tag created above. The earlier version of this line referred to `:2`, which
none of these commands ever creates, so it failed with `Error response from daemon: reference does not
exist`.)

**Loading the image**

```shell
docker image load -i docker-hello-world.tar
```

### Pushing to dockerhub

You need to have an account in DH and have created -previously- the repository (in this case, docker-hello-world).

```shell
docker image tag docker-hello-world:3 mydockerhub/docker-hello-world:3

docker login

docker push mydockerhub/docker-hello-world:3
```