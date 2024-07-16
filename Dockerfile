#FROM node:current-alpine
#FROM node:16.5.0-alpine
FROM node:20.15.1-alpine

ENV NODE_ENV=production

RUN mkdir /app
WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install --production

COPY . .
#port that will be exposed through docker config
EXPOSE 3022

#EXPOSE 3022

CMD ["npm", "start"]
