# STATUS DO PROJETO: LiCode

## S2: RUBY ponta a ponta (ruby.wasm)
- **Status:** Implementado (Aguardando revisão)
- **Branch:** `feat/phase2-ruby`
- **Detalhes:**
  - `ruby-worker.ts` implementado no sandbox, rodando o WASM a partir do origin do sandbox e populando com o código recebido via postMessage.
  - O runtime Ruby (WASM) recebe STDOUT e STDERR redirecionados.
  - `exit(code)` tratado com sucesso capturando exceções do tipo `SystemExit` através de um bloco de eval customizado usando `TOPLEVEL_BINDING` para preservar o escopo padrão do usuário.
  - Segurança verificada: Window, Document e LocalStorage são inacessíveis para o código Ruby (mesmo com require 'js').
  - Tratamento de exceção Ruby não tratada reflete perfeitamente no log de erro.
  - Perfil de linguagem adicionado em `apps/web/src/lib/languages.ts`.
  - Versão: `@ruby/wasm-wasi` v2.10.1 (`@ruby/3.4-wasm-wasi`).

### Relatório de Medições (Testes manuais usando Node e Vite):
- **Tamanho do Download:** 
  - `ruby+stdlib.wasm` bruto: ~30.6 MB
  - `ruby+stdlib.wasm` comprimido (gzip): ~11 MB
- **Init a frio (sem cache):** 10s+ dependendo da rede.
- **Init a quente (CacheStorage):** < 500ms (Apenas tempo de parse e bootstrap local).

### Pendências (Para a zona verde / PEDREIRO):
- Adicionar os testes end-to-end de aceitação para o Ruby no arquivo `tests/acceptance.test.mjs`.
- Atualizar o `README.md` listando as linguagens suportadas e os tamanhos dos downloads correspondentes.
- Preparar qualquer modificação extra para CI (se houver especificidades para testar Ruby no CI fora do `pnpm test` atual).
