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