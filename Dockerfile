FROM node:18-slim

# Only install minimal runtime deps (no Chrome - Chrome is not available on Render for free tier anyway)
RUN apt-get update \
    && apt-get install -y ca-certificates procps \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

CMD [ "node", "server.js" ]
