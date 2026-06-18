FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json ./
RUN bun install

COPY prisma ./prisma
RUN bunx prisma generate

COPY . .

EXPOSE 4002

CMD bunx prisma migrate deploy && bun run src/main.ts
