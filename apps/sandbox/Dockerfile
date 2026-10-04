# Estágio de Build
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable

# Copia manifestos de configuração e pacotes
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/protocol ./packages/protocol
COPY apps/sandbox ./apps/sandbox
COPY scripts ./scripts

# Instala dependências do workspace de forma congelada e determinística
RUN pnpm install --frozen-lockfile

# Compila o pacote de protocolo e o host do sandbox
RUN pnpm --filter @licode/protocol build

ARG VITE_ALLOWED_PARENT_ORIGINS
ENV VITE_ALLOWED_PARENT_ORIGINS=${VITE_ALLOWED_PARENT_ORIGINS}
RUN pnpm --filter @licode/sandbox build

# Estágio de Produção
FROM nginx:alpine

COPY apps/sandbox/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/sandbox/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
