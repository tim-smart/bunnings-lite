FROM node:25-alpine AS build
RUN npm i -g --force corepack && corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm i --frozen-lockfile --ignore-scripts
COPY . ./
RUN pnpm build


FROM node:25-alpine
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.cjs"]
