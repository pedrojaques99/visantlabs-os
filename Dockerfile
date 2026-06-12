FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip make g++ \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    openssl ffmpeg ghostscript \
    chromium fonts-liberation fonts-noto-color-emoji curl unzip \
    && pip3 install --no-cache-dir --break-system-packages rembg \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/
# Workspace packages (@visant/*) must exist BEFORE npm install: the install is
# what creates the node_modules symlinks and runs each package's prepare (tsc →
# dist). Without this, the server crashes at boot importing @visant/psd-engine.
COPY packages ./packages/

RUN NODE_ENV=development npm install --no-package-lock && \
    npm install @printmadehq/mockup-generator --legacy-peer-deps --no-package-lock && \
    npx prisma generate

COPY . .

EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
