FROM node:18-slim

# Install Chromium (lighter and faster to install than google-chrome)
RUN apt-get update \
    && apt-get install -y \
       chromium \
       ca-certificates \
       procps \
       fonts-ipafont-gothic \
       fonts-wqy-zenhei \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

CMD [ "node", "server.js" ]
