FROM node:20-alpine AS base

ENV NODE_ENV=production
WORKDIR /app

FROM base AS deps

ENV NODE_ENV=development

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder

ENV NODE_ENV=development

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM base AS runner

ENV NODE_ENV=production \
  PORT=3000 \
  HOSTNAME=0.0.0.0

RUN apk add --no-cache curl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/content ./content
COPY --from=builder --chown=node:node /app/app ./app
COPY --from=builder --chown=node:node /app/components ./components
COPY --from=builder --chown=node:node /app/lib ./lib
COPY --from=builder --chown=node:node /app/docs ./docs
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=node:node /app/tailwind.config.ts ./tailwind.config.ts
COPY --from=builder --chown=node:node /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=builder --chown=node:node /app/prettier.config.mjs ./prettier.config.mjs
COPY --from=builder --chown=node:node /app/eslint.config.mjs ./eslint.config.mjs
COPY --from=builder --chown=node:node /app/next-env.d.ts ./next-env.d.ts

RUN mkdir -p .next/cache && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD curl -f http://127.0.0.1:3000/ || exit 1

CMD ["npm", "run", "start"]
