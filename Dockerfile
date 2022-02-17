FROM node:current-alpine

ENV NODE_ENV=production

RUN mkdir /app
WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install --production

COPY . .
#port that will be exposed through docker config
EXPOSE 3022

CMD ["npm", "start"]
