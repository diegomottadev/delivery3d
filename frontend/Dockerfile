FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY . .

ENV PORT=3000 \
    CHOKIDAR_USEPOLLING=true \
    WDS_SOCKET_PORT=0

EXPOSE 3000

CMD ["npm", "start"]
