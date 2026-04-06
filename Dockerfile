FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY . .

# Create uploads and logs directories
RUN mkdir -p uploads logs

EXPOSE 3000

# Start script should run migrations then start server
CMD ["node", "src/server.js"]
