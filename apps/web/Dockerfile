# Estágio de Build
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable

# Configuração da URL do sandbox injetada em tempo de build
ARG PUBLIC_SANDBOX_URL=http://localhost:8081
ENV PUBLIC_SANDBOX_URL=$PUBLIC_SANDBOX_URL

# Copia manifestos de configuração e código de todos os pacotes necessários
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/protocol ./packages/protocol
COPY packages/runtime-core ./packages/runtime-core
COPY packages/runtime-js ./packages/runtime-js
COPY packages/runtime-python ./packages/runtime-python
COPY apps/web ./apps/web

# Instala dependências de forma congelada
RUN pnpm install --frozen-lockfile

# Compila pacotes na ordem topológica de dependências
RUN pnpm --filter @licode/protocol build
RUN pnpm --filter @licode/runtime-core build
RUN pnpm --filter @licode/runtime-js build
RUN pnpm --filter @licode/runtime-python build
RUN pnpm --filter @licode/web build

# Estágio de Produção
FROM nginx:alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
