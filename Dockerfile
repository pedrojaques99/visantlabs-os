FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production && \
    npx prisma generate

COPY . .

EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
