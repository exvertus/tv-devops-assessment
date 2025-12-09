# ============================
#           Build 
# ============================
FROM node:24-alpine AS build

RUN mkdir -p /app && chown node:node /app

USER node
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node tsconfig.json ./
COPY src ./src

RUN npm run build

# ============================
#          Runtime
# ============================
FROM node:24-alpine AS runtime

USER node
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node --from=build /app/dist ./dist
EXPOSE 3000

CMD ["node", "dist/server.js"]