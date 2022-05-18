# Containers

<!-- TODO:
  What is a container
 -->

## Some useful commands

**List running containers**

If we want to see all containers, including the stopped ones, we can use the flag `-a`

```shell
docker ps
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
docker run image -p host-port:container-port
```

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
2. Start container with a volume: `docker run -d -p 9090:9090 -v volume-name:/path-to-folder/in-container container-id`

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
docker run -d -p 9090:9090 -v path-to-folder/in-host:/path-to-folder/in-container container-id
```

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