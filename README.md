# LiCode.dev — IDE no navegador

O LiCode executa código no navegador usando Web Workers e WebAssembly, sem servidor de execução.

## Executar localmente

Pré-requisitos: Node.js 20 ou superior e pnpm 12.

```bash
pnpm install
pnpm dev
```

Abra [http://localhost:5173](http://localhost:5173). O comando inicia a aplicação web na porta 5173 e o host isolado de execução na porta 5174.

## Build e verificações

```bash
pnpm build
pnpm typecheck
pnpm test
```

## Estrutura

- `apps/web`: interface SvelteKit, editor e integração com os runtimes.
- `apps/sandbox`: host isolado por origem que inicia workers efêmeros para executar código.
- `packages/protocol`: tipos das mensagens entre interface, sandbox e workers.
- `packages/runtime-core`: interfaces e registro de runtimes.
- `packages/runtime-*`: runtimes de JavaScript, Python e Ruby.

## Linguagens

- JavaScript: engine nativa do navegador, em worker isolado.
- TypeScript: transpilado em worker separado.
- Python: CPython via Pyodide/WebAssembly.
- Ruby: CRuby via ruby.wasm.
- C: compilação e execução via WebAssembly/WASI no navegador.

## Segurança e limites

O código roda em uma origem separada da interface, em workers descartáveis. Um watchdog externo ao worker interrompe programas que excedem o limite de execução; a saída também tem limite para evitar travar a aba. Entrada interativa por stdin ainda não é suportada.
