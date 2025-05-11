FROM node:22 AS deps
RUN mkdir -p /app && corepack enable
WORKDIR /app
COPY package.json .
COPY pnpm-lock.yaml .
RUN pnpm i --frozen-lockfile


FROM node:22 AS deps-prod
RUN mkdir -p /app && corepack enable
WORKDIR /app
COPY package.json .
COPY pnpm-lock.yaml .
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm prune --prod


FROM node:22 AS build
RUN mkdir -p /app && corepack enable
WORKDIR /app
COPY package.json .
COPY pnpm-lock.yaml .
COPY --from=deps /app/node_modules ./node_modules
COPY . ./
RUN pnpm build


# Runtime image
FROM node:22
WORKDIR /app
ENV NODE_ENV=production
ENV TINI_VERSION=v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

COPY package.json .
COPY pnpm-lock.yaml .
COPY --from=deps-prod /app/node_modules ./node_modules
RUN ./node_modules/.bin/playwright install-deps chromium && \
    ./node_modules/.bin/playwright install chromium

COPY --from=build /app/dist ./dist
CMD [ "node", "dist/main.js" ]
