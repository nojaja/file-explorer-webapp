# syntax=docker/dockerfile:1
FROM node:18.20.7
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ENV NODE_ENV=production
CMD ["node", "src/backend/index.js"]
