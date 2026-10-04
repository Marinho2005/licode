FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.6 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/sandbox/package.json ./apps/sandbox/
COPY packages ./packages

COPY scripts ./scripts

RUN pnpm install

COPY apps/sandbox ./apps/sandbox

RUN pnpm --filter @licode/sandbox build

FROM nginx:1.27-alpine AS nginx
WORKDIR /usr/share/nginx/html

COPY --from=builder /app/apps/sandbox/dist ./
COPY apps/sandbox/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
