FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip make g++ \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    openssl ffmpeg \
    && pip3 install --no-cache-dir --break-system-packages rembg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/

RUN NODE_ENV=development npm install --no-package-lock && \
    npx prisma generate

COPY . .

EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
