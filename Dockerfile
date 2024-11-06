# Use the latest alpine-based Node.js image
FROM node:20.15.1-alpine

# Set environment variable
ENV NODE_ENV=production

RUN apk update && apk add --no-cache \
    chromium \
    chromium-chromedriver \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Create and set the working directory
RUN mkdir /app
WORKDIR /app

# Copy package.json and yarn.lock if present
COPY package.json ./
COPY yarn.lock ./

# Install dependencies using yarn and clean the cache
RUN yarn install --production && yarn cache clean --force

# Copy the rest of the application code
COPY . .

# Expose port 3022
EXPOSE 3022

# Define the command to run the application
CMD ["yarn", "start"]
