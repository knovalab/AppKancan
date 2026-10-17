FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3010 \
    TZ=America/Bogota

RUN apk add --no-cache tzdata

# Solo dependencias de producción (hono, @hono/node-server).
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

RUN chown -R node:node /app
USER node

EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3010/health >/dev/null || exit 1

CMD ["node", "src/server.ts"]
