# LiCode.dev — In-Browser Isolation IDE

O **LiCode.dev** é uma IDE online que executa código inteiramente no navegador via Web Workers e WebAssembly, sem servidor de execução.

---

## 🐳 Rodar com Docker (Um Único Comando)

Para rodar todo o ambiente em produção com containers Nginx isolados e origens separadas:

```bash
git clone https://github.com/seu-usuario/licode.git && cd licode
docker compose up --build
```

Em seguida, abra no navegador:
👉 **[http://localhost:8080](http://localhost:8080)**

- **App Web (UI):** [http://localhost:8080](http://localhost:8080)
- **Sandbox Host (Execução Isolada):** [http://localhost:8081](http://localhost:8081)

---

## ⚠️ Problemas Comuns

### 1. Portas 8080 ou 8081 já ocupadas
Se as portas padrão já estiverem em uso no seu sistema, você pode redefini-las passando variáveis de ambiente antes do `docker compose`.
> **IMPORTANTE:** A URL do sandbox (`PUBLIC_SANDBOX_URL`) deve acompanhar a porta configurada para o sandbox (`SANDBOX_PORT`):
```bash
# Exemplo usando as portas 8090 e 8091:
WEB_PORT=8090 SANDBOX_PORT=8091 docker compose up --build
```
Acesse em: `http://localhost:8090`.

### 2. Tela em branco ou falha de conexão com o sandbox
- Certifique-se de que o container do sandbox está saudável (`docker compose ps`).
- Se você alterou a porta do sandbox no host, é obrigatório recompilar o container web (`--build`) para que a nova URL seja injetada no build estático da UI.

---

## 💻 Rodar em Desenvolvimento Local (sem Docker)

### Pré-requisitos
- Node.js >= 20
- pnpm >= 9 (recomendado 12.x)

```bash
# 1. Instalar dependências
pnpm install

# 2. Iniciar apps/web (porta 5173) e apps/sandbox (porta 5174)
pnpm dev

# 3. Abrir http://localhost:5173
```

### Build e Verificação
```bash
# Checagem estrita de tipos TypeScript
pnpm typecheck

# Compilação de todos os pacotes e apps
pnpm build

# Testes automatizados de ponta a ponta (Playwright E2E)
pnpm test
```

---

## 📁 Estrutura de Pastas

```
licode/
├── apps/
│   ├── sandbox/               # Host de isolamento estático (Vite + TS -> Nginx na porta 8081)
│   │   ├── Dockerfile         # Multi-stage: Node 22 Alpine -> Nginx Alpine
│   │   ├── nginx.conf         # COOP/COEP headers, MIME types .wasm/.js, healthcheck /healthz
│   │   └── src/
│   │       ├── main.ts        # Handshake inicial e recepção do MessagePort
│   │       ├── session-host.ts# Gerencia ciclo de vida do Worker, timeout e output-limit
│   │       └── worker/
│   │           └── exec-worker.ts # Web Worker efêmero e descartável
│   │
│   └── web/                   # Aplicação principal (SvelteKit + Svelte 5 -> Nginx na porta 8080)
│       ├── Dockerfile         # Multi-stage com build arg PUBLIC_SANDBOX_URL -> Nginx Alpine
│       ├── nginx.conf         # SPA fallback e healthcheck /healthz
│       └── src/
│           ├── lib/
│           │   ├── config.ts          # URL do sandbox dinâmica (PUBLIC_SANDBOX_URL)
│           │   ├── sandbox-bridge.ts  # Ponte de conexão com o iframe e MessageChannel
│           │   └── runtime-service.ts # Instanciação do RuntimeManager e JS Runtime
│           └── routes/
│               └── +page.svelte       # UI: Textarea, botões Run/Stop, Presets, Console
│
├── packages/
│   ├── protocol/              # Protocolo tipado e versionado (TS puro)
│   ├── runtime-core/          # Interfaces e Registry de Runtimes (TS puro)
│   └── runtime-js/            # Implementação do Runtime JavaScript (TS puro)
│
├── .github/workflows/ci.yml   # Workflow GitHub Actions: typecheck, build e docker build
├── docker-compose.yml         # Orquestração com origens separadas (8080 vs 8081) e healthcheck
├── .dockerignore              # Exclusão de node_modules, .git, builds locais
├── tests/acceptance.test.mjs  # Testes e2e de validação dos critérios de aceite
├── pnpm-workspace.yaml
└── package.json
```

---

## 🌐 Linguagens Suportadas

O sistema suporta nativamente a execução no navegador das seguintes linguagens utilizando WebAssembly (Wasm):

- **JavaScript**: Executado diretamente através da engine nativa com isolamento.
- **Python (Pyodide)**: Distribuição do CPython para navegador (via WebAssembly).
- **Ruby (ruby.wasm)**: Porta oficial do interpretador CRuby em WebAssembly.

---

## 🖥️ Terminal Integrado (Xterm.js)

O componente visual de saída utiliza o **xterm.js**, fornecendo uma experiência de terminal rica similar à do VSCode, com cores ANSI e suporte completo a streams e formatação de sistema.

**Limitações Atuais:**
- Apenas saída interativa (Stdout/Stderr);
- *Stdin* interativo ainda não é suportado pelo runtime do browser. (Entradas devem ser tratadas em modo "batch" ou enviadas no pacote inicial da sessão).

---

## 🧠 Arquitetura e Segurança

1. **Separação Obrigatória de Origens:**
   - O código do usuário **nunca roda** na origem do app principal (`localhost:8080`).
   - A UI principal embute um `<iframe>` apontando para o app sandbox em `http://localhost:8081`.
   - Por aplicação nativa da *Same-Origin Policy* (SOP) dos navegadores, scripts executando na origem 8081 não possuem qualquer acesso a `window`, `document`, cookies, tokens ou `localStorage` de 8080.
2. **Workers Efêmeros e Watchdog de Timeout:**
   - Cada execução cria um novo `new Worker(...)` descartável.
   - O watchdog de timeout roda fora do worker (no sandbox host), cancelando a execução após 3s mesmo se o código travar em loop síncrono `while (true) {}`.
3. **Batching e Quota de Saída:**
   - Logs agrupados em lotes de ~16ms com corte ao atingir 256 KB (`output-limit`), impedindo travamento da aba.
