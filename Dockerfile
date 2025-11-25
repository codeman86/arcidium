FROM node:20-alpine AS base

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  HUSKY=0

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

FROM node:20-alpine

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  COLLAB_HOST=0.0.0.0 \
  COLLAB_PORT=1234 \
  COLLAB_DB_PATH=/app/data/collab.sqlite \
  NEXT_PUBLIC_COLLAB_WEBSOCKET=ws://localhost:1234 \
  NEXT_PUBLIC_COLLAB_ROOM=arcidium-test-collab

WORKDIR /app

RUN apk add --no-cache tini \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nextjs -u 1001 -G nodejs \
  && mkdir -p /app/data /app/content \
  && chown -R nextjs:nodejs /app

COPY --from=base --chown=nextjs:nodejs /app/public ./public
COPY --from=base --chown=nextjs:nodejs /app/.next ./.next
COPY --from=base --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=nextjs:nodejs /app/package*.json ./
COPY --from=base --chown=nextjs:nodejs /app/collab-server.js ./collab-server.js
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000 1234

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["tini", "--", "/app/docker-entrypoint.sh"]
