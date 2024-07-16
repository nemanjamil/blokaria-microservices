# Use the latest alpine-based Node.js image
FROM node:20.15.1-alpine

# Set environment variable
ENV NODE_ENV=production

# Create and set the working directory
RUN mkdir /app
WORKDIR /app

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Install dependencies using yarn
RUN yarn install --production

# Copy the rest of the application code
COPY . .

# Expose port 3022
EXPOSE 3022

# Define the command to run the application
CMD ["yarn", "start"]