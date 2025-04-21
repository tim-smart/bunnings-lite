FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
COPY dist/main.js ./main.js

CMD ["node", "main.js"]
