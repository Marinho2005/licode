# STATUS DO PROJETO: LiCode

## Visão Geral
IDE online para execução segura e isolada de código no navegador via Web Workers e WebAssembly, sem servidor de execução backend.
Arquitetura de desenvolvimento: Engenharia integrada ponta a ponta (Full-Cycle), com entregas contínuas de implementação, testes E2E e documentação.

---

## 🚀 Fases Concluídas

### S0: Fundação & Segurança Estrutural
- **Status:** ✅ Concluído e Validado
- **Principais Entregas:**
  - Isolamento estrito de origens via Same-Origin Policy (UI em `:8080`, Sandbox em `:8081`).
  - Headers HTTP de isolamento cross-origin (`COOP: same-origin`, `COEP: require-corp`) e CSP (`frame-ancestors`).
  - Bloqueio automático de execução de sandbox na mesma origem.
  - Handshake criptográfico/estruturado de porta única: inicializações secundárias ou não autorizadas são ignoradas silenciosamente.
  - Testes de aceitação cobrindo bloqueio de same-origin e rejeição de handshake duplo.

### S1: Runtimes JS & Python (Pyodide)
- **Status:** ✅ Concluído e Validado
- **Principais Entregas:**
  - Runtime nativo JavaScript com hooks de console (`stdout`, `stderr`).
  - Runtime Python 3.12 via Pyodide WebAssembly integrado.
  - Web Workers efêmeros descartáveis a cada execução (`new Worker(...)`).
  - Watchdog de timeout (3s) e limitador de saída (corte aos 256 KB em lotes de ~16ms).
  - UI reativa em Svelte 5 com seletor de linguagem e persistência de presets.
  - Testes de aceitação automatizados para execução, timeout e quotas.

### S2: Runtime Ruby (ruby.wasm)
- **Status:** ✅ Concluído e Validado
- **Principais Entregas:**
  - `ruby-worker.ts` implementado no sandbox, executando WebAssembly a partir da origem isolada.
  - Versão: `@ruby/wasm-wasi` v2.10.1 (`@ruby/3.4-wasm-wasi`).
  - Redirecionamento completo de STDOUT e STDERR.
  - Tratamento de `exit(code)` com captura de `SystemExit` através de bloco eval preservando `TOPLEVEL_BINDING`.
  - Isolamento verificado: `Window`, `Document` e `LocalStorage` totalmente inacessíveis.
  - Bateria completa de testes de aceitação em `tests/acceptance.test.mjs` cobrindo saída padrão, timeout de 3s em loop infinito, corte por flood de output (256 KB), captura de exceptions/stacktrace e interrupção imediata via SIGKILL/Stop.
- **Métricas:**
  - Payload `ruby+stdlib.wasm`: ~30.6 MB bruto (~11 MB com gzip).
  - Init a frio: 5-10s (dependente de banda de rede).
  - Init a quente (CacheStorage): < 500ms.

### S3: Console de Terminal Integrado (Xterm.js)
- **Status:** ✅ Concluído e Validado
- **Principais Entregas:**
  - Integração de `@xterm/xterm` e `@xterm/addon-fit` via componente Svelte dedicado (`Terminal.svelte`).
  - Suporte completo a cores ANSI (`\x1b[31m` para erros, formatações de sistema atenuadas).
  - Renderização otimizada com buffering via `requestAnimationFrame` fora do estado reativo do Svelte.
  - Buffer de scrollback configurado para 5.000 linhas.
  - Instância exposta para instrumentação de testes E2E (`window.__xterm`).
  - Suíte de testes de aceitação adaptada para inspecionar diretamente o buffer do terminal.

### S6: Deploy em Produção com Isolamento Estrito de Origem
- **Status:** ✅ Concluído e Validado
- **Principais Entregas:**
  - Deploy de duas origens independentes na Vercel:
    - Web: `https://licode-web.vercel.app`
    - Sandbox: `https://licode-sandbox.vercel.app`
  - Injeção das URLs em tempo de build (`PUBLIC_SANDBOX_URL` e `VITE_ALLOWED_PARENT_ORIGINS`).
  - Falha fechada: sandbox sem configuração recusa handshakes.
  - CSP com `frame-ancestors https://licode-web.vercel.app` ativo no sandbox; bloqueio comprovado contra embed de terceiros via Playwright.
  - Isolamento com headers COOP (`same-origin`), COEP (`require-corp`) e CORP (`cross-origin`).
  - Arquivos `_headers` e `vercel.json` integrados às pastas de saída (`apps/web/build` e `apps/sandbox/dist`).
  - Cache imutável (`Cache-Control: public, max-age=31536000, immutable`) para assets WASM (`ruby+stdlib.wasm` 30 MB e `pyodide.asm.wasm` 9.6 MB).
  - Servindo `.wasm` com MIME type nativo `application/wasm`.
  - Redesign da interface sincronizado com layout do protótipo visual.

---

## 📋 Próximos Marcos (Roadmap)

### S4: Editor de Código Avançado
- Substituição do editor simples por editor baseado em Monaco Editor ou CodeMirror 6.
- Syntax highlighting dinâmico por linguagem (JS, Python, Ruby, C, TypeScript).
- Atalhos de teclado comuns (Ctrl+Enter para executar, indentação inteligente).

### S5: Suporte a Entrada Interativa (Stdin)
- Suporte a `input()` / `gets` / `readline` sem travar a thread do navegador.
- Abordagem via buffer inicial de entrada ou canal síncrono interativo com `SharedArrayBuffer` + `Atomics.wait`.

