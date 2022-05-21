# Docker Compose

Check you have `docker-compose` installed in your device, if not, installed.

```shell
docker-compose -v
```

## 

<!-- -->
```
docker-compose up

docker-compose down
```

<!-- -->
```
docker-compose build
```

Sample `docker-compose.yml` for 3 services `frontend`, `backend` and `database`.



```yml
version: "3.9" # optional since v1.27.0

services:
  frontend:
    depends_on: 
      - backend
    # build points to the Dockerfile, in this case ./frontend/Dockerfile
    build: ./frontend
    ports:
      - 3000:3000

  backend: 
    depends_on: 
      - db
    build: ./backend
    ports: 
      - 8080:8080
    environment: 
      DB_URL: mongodb://database/my-app
    command: ./docker-entrypoint.sh

  database:
    image: mongo
    ports:
      - 27017:27017
    volumes:
      - my-app:/data/db

volumes:
  my-app:

```

### Related resources:

**Frontend Dockerfile**
./frontend/Dockerfile

```yml
FROM alpine:3.14

RUN addgroup app && adduser -S -G app app
USER app

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000 

CMD ["npm", "start"]
```

**Backend Dockerfile**
./backend/Dockerfile

```yml
FROM alpine:3.14

RUN addgroup app && adduser -S -G app app
USER app

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . . 

EXPOSE 8080

CMD ["npm", "start"]
```