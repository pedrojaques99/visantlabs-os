FROM node:20-alpine

RUN apk add --no-cache \
    python3 make g++ \
    cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci && \
    npx prisma generate

COPY . .

EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
