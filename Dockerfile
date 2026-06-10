FROM node:24-alpine3.21 AS builder

ENV NPM_CONFIG_MAXSOCKETS=5 \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=300000

COPY . /app

WORKDIR /app

RUN npm install && \
    npm run build

FROM node:24-alpine3.21

ENV NPM_CONFIG_MAXSOCKETS=5 \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=300000

RUN mkdir -p /home/node/app && \
    chown node:node -R /home/node/app

COPY --from=builder --chown=node:node /app/healthcheck.js /home/node/healthcheck.js
COPY --from=builder --chown=node:node /app/dist /home/node/app/dist
COPY --from=builder --chown=node:node /app/package.json /home/node/app/package.json
COPY --from=builder --chown=node:node /app/package-lock.json /home/node/app/package-lock.json

USER node


WORKDIR /home/node/app

RUN npm install --omit=dev

CMD [ "node" , "dist/main.js" ]
