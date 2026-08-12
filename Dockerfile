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

# `npm ci`, nao `npm install --no-package-lock`.
#
# O passo anterior jogava o package-lock.json fora e re-resolvia a arvore
# inteira do registry a cada build: 8 a 10 minutos de CPU e disco na VPS, e
# duas imagens do MESMO commit podendo nascer diferentes. `npm ci` instala
# exatamente o que esta no lock — mais rapido e reproduzivel. Ele tambem roda o
# `prepare` dos workspaces (@visant/* → dist), que e o que o servidor importa no
# boot; por isso o COPY packages continua vindo antes.
#
# `--include=dev` e explicito porque o Coolify injeta NODE_ENV=production no
# build, e o runtime roda por `tsx`, que e devDependency.
#
# O @printmadehq/mockup-generator fica FORA do lock de proposito: ele declara
# peers que este repo nao satisfaz (ag-psd ^28 aqui e ^30, puppeteer que nem
# existe aqui) e adicionar ao package.json faria todo `npm install` local
# quebrar em ERESOLVE. O consumidor o carrega por caminho de arquivo
# (server/scripts/psd-render-worker.ts) e degrada sozinho se faltar. Versao
# fixa para o build nao mudar sem alguem decidir; `--no-save --no-package-lock`
# garante que ele nao suje o lock dentro da imagem.
RUN npm ci --include=dev && \
    npm install @printmadehq/mockup-generator@1.0.5 --legacy-peer-deps --no-save --no-package-lock && \
    npx prisma generate

COPY . .

EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
