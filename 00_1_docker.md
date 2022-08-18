# Docker

## Installing docker

Go to https://docs.docker.com/get-docker/ and download `Docker Desktop` (for Mac or Windows) or `Docker Engine` (Linux).
You can also use `Docker Toolbox` for older systems.

After installation, run `docker version`.

Sample output:

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
npm install
```

### Add the Dockerfile

Dockerfile

```Dockerfile
# Base image. In this case is node alpine lts which is based on linux image
FROM node:lts-alpine

# Copy all our files in src to the /app directory
WORKDIR /app
COPY package*.json ./
COPY src .

RUN npm install

EXPOSE 3000

# Run our app
CMD ["npm", "start"]
```

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

**Show history of an image**

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
docker image save -o docker-hello-world.tar docker-hello-world:2
```

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