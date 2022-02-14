#FROM node:current-alpine
FROM node:16.5.0-alpine

ENV NODE_ENV=production

RUN mkdir /app
WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install --production

COPY . .

CMD ["npm", "start"]
