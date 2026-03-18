FROM node:24-alpine3.21 AS builder

COPY . /app

WORKDIR /app

RUN npm ci && \
    npm run build

FROM node:24-alpine3.21

RUN mkdir -p /home/node/app && \
    chown node:node -R /home/node/app

COPY --from=builder --chown=node:node /app/dist /home/node/app/dist
COPY --from=builder --chown=node:node /app/package.json /home/node/app/package.json
COPY --from=builder --chown=node:node /app/package-lock.json /home/node/app/package-lock.json

USER node

WORKDIR /home/node/app

RUN npm install --omit=dev

CMD [ "node" , "dist/main.js" ]
