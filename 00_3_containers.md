# Containers

A container is a process on the host, isolated by kernel features rather than virtualised. It gets
its own namespaces (filesystem mounts, process ids, network, hostname, users) so it sees its own
world, and cgroups cap what it can consume. What it does *not* get is its own kernel: containers on
one host all share the host's, which is why a Linux container cannot run on Windows without a Linux
VM underneath, and why Docker on macOS runs everything inside a Linux virtual machine.

The practical consequences show up throughout these notes:

- **An image is a stack of read-only layers; a container is an image plus one writable layer.** Deleting
  a container discards that layer, which is why anything worth keeping goes in a volume.
- **`localhost` inside a container is the container**, not the host, because the network namespace is
  its own.
- **`ps` inside a container shows only its own processes**, and the entrypoint is PID 1, which has
  consequences for signals (see the signals section in `00_2_Dockerfile.md`).

## Some useful commands

**List running containers**

```shell
# running containers only
docker ps

# all containers, including stopped ones
docker ps -a
```

**Run a container**

```shell
docker run -p 80:9090 image
```

Note: 80:9090 represents the ports of HOST:CONTAINER


We can run the container in detached mode so it will run in the background.

```shell
docker run -d image
```

**Checking logs of a container**

```shell
docker logs container-id
```

Some useful flags:

* `-f` to follow logs output
* `-n 10` shows the last 10 lines
* `-t` shows the timestamp

**Publishing ports**

```shell
docker run -p host-port:container-port image
```

**Flags go before the image name.** Everything after it is passed to the container as its command,
so the reverse order does not publish anything. Measured:

```shell
$ docker run nginx:alpine -p 18098:80
/docker-entrypoint.sh: exec: line 47: illegal option -p
```

The container started and then failed trying to run `-p 18098:80` as a program. An earlier version of
these notes had the arguments this way round in this section while getting it right in the "Run a
container" section above.

**Executing commands in running container**

```shell
docker exec container-id command
```

Example of opening a shell session:

```shell
docker exec -it container-id sh
```

**Copying files between host and container**

```shell
docker run -d image

# To grab the container ID
docker ps

# Copying from container to host
docker cp container-id:/path-to-resource /host-path

# Copying from host to container
docker cp /host-path/to-file container-id:/container-path
```

Real examples:
```
docker cp ff6b6ce8da52:/etc/passwd .

docker cp notes.md ff6b6ce8da52:/etc/
```

**Volumes**

We use volumes to persist data.
They can be directories in the host or in the cloud.

1. Create the volume: `docker volume create volume-name`
2. Start container with a volume: `docker run -d -p 9090:9090 -v volume-name:/path-to-folder/in-container image`

   The last argument is an **image**, not a container id: `docker run` creates a new container from an
   image, so there is no container yet to name. Use `docker start` to restart an existing one.

You can use the `--mount` flag instead of `-v` which is more explicit and verbose.

If you want to inspect your volume: `docker volume inspect volume-name`

Sample output:

```shell
[
    {
        "CreatedAt": "2022-04-11T15:37:02Z",
        "Driver": "local",
        "Labels": {},
        "Mountpoint": "/var/lib/docker/volumes/volume-name/_data",
        "Name": "volume-name",
        "Options": {},
        "Scope": "local"
    }
]
```

Remember, docker in MAC runs in Linux VM. The Mountpoint refers to a path inside the VM, not the host (MAC)

We can also map a directory in the host machine to a directory inside the container:

```shell
docker run -d -p 9090:9090 -v /absolute-path/in-host:/path-to-folder/in-container image
```

Again an image rather than a container id. The host side of a bind mount should be an absolute path:
Docker treats a bare relative name as a *named volume*, not a directory, so `-v data:/app/data`
silently creates a volume called `data` instead of mounting `./data`.

**Stop a container**

```shell
docker stop container-id
```

If we want to `start a stopped container`, we can use

```shell
docker start container-id
```

**Deleting stopped containers**

```shell
docker container prune
```

**Removing a container**

```shell
docker rm container-id
```

We can remove ALL containers (running and stopped ones):

```shell
docker rm -f $(docker container ls -aq)
```

⚠️ That is every container on the machine, not just this project's, and `-f` kills running ones. On a
machine with anything else on it, prefer `docker compose down` for a compose project, or pass the
names you mean. `$(...)` with no containers present leaves `docker rm -f` with no arguments, which
errors harmlessly.