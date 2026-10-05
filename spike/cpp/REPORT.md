# S5: Spike C/C++ no browser

**Resultado: inconclusivo para integração; não aprovado para produção.** O browser ficou cross-origin isolated e o caso C chegou à instanciação do WebAssembly, mas falhou por import WASI ausente. O caso C++ não saiu da fase de compilação no tempo observado. Nenhum arquivo de `apps/`, `packages/`, Docker, compose ou CI foi integrado.

## Evidências

Servidor em `http://127.0.0.1:4173/`, Chromium embutido no VS Code/Linux. Comando usado para conferir a resposta:

```sh
curl -sSI http://127.0.0.1:4173/
```

Saída:

```text
HTTP/1.1 200 OK
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: cross-origin
Access-Control-Allow-Origin: *
Cache-Control: no-store
Content-Type: text/html; charset=utf-8
```

Na página, `window.crossOriginIsolated` apareceu como `true`. Ao clicar **Compilar + Rodar** com a amostra C (`hello.c`), o worker mostrou:

```text
crossOriginIsolated = true
phase:compiling
ERROR: WebAssembly.instantiate(): Import #0 "env": module is not an object or function
```

A falha ocorre depois da compilação e leitura do artefato: o worker instancia o módulo usando `browser_wasi_shim`, mas o módulo pede o namespace `env`, não fornecido por essa configuração. Não foi comprovada a execução do programa C.

Com a amostra C++, a página mostrou `phase:compiling` e não avançou por mais de quatro minutos. O worker foi encerrado pelo botão Stop:

```text
crossOriginIsolated = true
phase:compiling
Stop requested; worker terminated.
```

## Escopo e conclusão

- Confirmado: os headers permitem `crossOriginIsolated = true` no ambiente testado; o caminho Wasmer/`clang/clang` iniciou no worker e o caso C chegou à instanciação de um módulo.
- Não confirmado: execução bem-sucedida de C ou C++, stdin, tratamento de erros de compilação, limites de tempo/memória, tamanho do download e comportamento dos demais samples (`vector.cpp`, `exceptions.cpp`, casos de erro/loop/saída).
- Próximo passo antes de qualquer proposta de integração: resolver o contrato entre o artefato emitido pelo compilador e o runtime WASI do browser, então repetir a matriz completa e medir cold/warm start e tamanho dos assets.

Não construir LLVM do zero nem integrar no produto nesta etapa. O spike não demonstra ainda um ciclo compilar-e-executar funcional; qualquer decisão de integração precisa aguardar uma nova validação e aprovação explícita.

---

# Auditoria e revalidação do spike — 2026-10-04 (America/Bahia)

O bloco histórico acima foi preservado sem edição. Esta seção registra uma nova rodada no mesmo spike e não substitui os resultados anteriores.

## Ambiente e comando testado

- Página: `http://127.0.0.1:4173/`.
- Browser automatizado: Chromium headless `153.0.8010.12`, Linux x86_64.
- `window.crossOriginIsolated`: `true`.
- A página respondeu com `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Embedder-Policy: require-corp`.
- Ação em cada caso: selecionar C/C++, inserir o conteúdo do sample em `#source` e clicar `#run-btn` (“Compilar + Rodar”). O caso inválido usou o código de sintaxe abaixo.
- Comando efetivo de compilação C: `clang -target wasm32-wasi -O0 -g0 -Wl,--export=main /workspace/main.c -o /workspace/main.wasm`.
- Comando efetivo de compilação C++: `clang -std=c++17 -target wasm32-wasi -O0 -g0 -Wl,--export=main /workspace/main.cpp -o /workspace/main.wasm`.
- O worker carrega `clang/clang` com `@wasmer/sdk` 0.19.0, compila com `sandbox.command(...).spawn()` e encaminha stdout/stderr do compilador. Para execução, instala o Wasm produzido como pacote temporário e chama `sandbox.command('main').run()` no mesmo runtime Wasmer.
- A entrada manual do tempo limite é 20 s na UI: o watchdog encerra o Worker, registra `ui-watchdog-timeout` e libera Run. Stop encerra o Worker imediatamente. Há também limites de processo configurados no worker; a compilação WASM pode bloquear esse worker antes de seus timers executarem, por isso a UI mantém o watchdog independente.

## Imports reais observados

Antes de executar, o worker compila o artefato e coleta `WebAssembly.Module.imports(module)` e `WebAssembly.Module.exports(module)`. Para `hello.c` compilado com `-O0`, o console do browser mostrou literalmente:

```text
WASM imports (10):
[
  {
    "module": "env",
    "name": "memory",
    "kind": "memory"
  },
  {
    "module": "wasi_snapshot_preview1",
    "name": "fd_close",
    "kind": "function"
  },
  {
    "module": "wasi_snapshot_preview1",
    "name": "fd_fdstat_get",
    "kind": "function"
  },
  {
    "module": "wasi_snapshot_preview1",
    "name": "fd_seek",
    "kind": "function"
  },
  {
    "module": "wasi_snapshot_preview1",
    "name": "fd_write",
    "kind": "function"
  },
  {
    "module": "wasi_snapshot_preview1",
    "name": "proc_exit",
    "kind": "function"
  },
  {
    "module": "wasix_32v1",
    "name": "callback_signal",
    "kind": "function"
  },
  {
    "module": "wasix_32v1",
    "name": "futex_wait",
    "kind": "function"
  },
  {
    "module": "wasix_32v1",
    "name": "futex_wake",
    "kind": "function"
  },
  {
    "module": "wasix_32v1",
    "name": "futex_wake_all",
    "kind": "function"
  }
]
WASM exports (10):
[
  {
    "name": "__stack_pointer",
    "kind": "global"
  },
  {
    "name": "__tls_base",
    "kind": "global"
  },
  {
    "name": "__tls_size",
    "kind": "global"
  },
  {
    "name": "__tls_align",
    "kind": "global"
  },
  {
    "name": "__wasm_init_tls",
    "kind": "function"
  },
  {
    "name": "_start",
    "kind": "function"
  },
  {
    "name": "main",
    "kind": "function"
  },
  {
    "name": "__heap_base",
    "kind": "global"
  },
  {
    "name": "__data_end",
    "kind": "global"
  },
  {
    "name": "__wasm_signal",
    "kind": "function"
  }
]
```

O erro inicial não foi provocado pelo simples fato de usar `-target wasm32-wasi`: a opção produziu um executável com `_start`, imports WASI e também imports WASIX. A tabela de imports não era fornecida pelo objeto passado ao instanciar o módulo: o código fornecia apenas `wasi_snapshot_preview1`, deixando `env.memory` sem namespace e também sem implementação `wasix_32v1`. `browser_wasi_shim` 0.4.2 não implementava o contrato completo desse módulo. A correção foi usar o runtime Wasmer do próprio SDK para executar o artefato; esse runtime executou o sample C. Portanto, a causa observada da falha de instanciação era a integração runtime/imports, e não a falta de `-Wl,--export=main`.

O caminho C++ tem ainda um problema separado: a compilação não retorna dentro do limite observável. `clang++` não é um comando instalado no pacote; `clang` aceita os `.cpp`, mas os samples testados não terminaram nem com `-O0`. Isso falha antes de produzir WASM, portanto não é evidência de defeito no runtime durante execução C++.

## Resultados por caso

| Caso e ação | Resultado observado | Exit code | Stdout do programa | Stderr do programa / compilador | Duração observada | Artefato |
|---|---|---:|---|---|---:|---:|
| `hello.c`, compilar + executar | **Passou** | 0 | `hello from C\n` (newline final) | vazio | 9.245 ms total; 1.003 ms compilação | 47.379 bytes |
| `hello.cpp`, compilar + executar | **Timeout da UI** | indisponível | vazio | vazio | 20.058 ms; watchdog em 20.001 ms | nenhum |
| `vector.cpp`, compilar + executar | **Timeout da UI** | indisponível | vazio | vazio | 20.050 ms; watchdog em 20.001 ms | nenhum |
| `exceptions.cpp`, compilar + executar | **Timeout da UI** | indisponível | vazio | vazio | 20.043 ms; watchdog em 20.001 ms | nenhum |
| Código inválido `int main( {\n  return 0;\n}\n`, compilar | **Erro de sintaxe detectado** | 1 (compilador) | vazio | mensagens do Clang copiadas abaixo | 1.428 ms total; 480 ms compilação | nenhum |
| `hello.c` repetido no mesmo Chromium | **Passou** | 0 | `hello from C\n` (newline final) | vazio | 2.274 ms total; 1.163 ms compilação | 47.379 bytes |

### Evidência literal — C passou

```text
crossOriginIsolated = true
phase:compiling
phase:running
phase:done
Compile duration: 1003ms
Total duration: 9125ms
WASM size: 47379 bytes
Program exit code: 0
Program stdout:
hello from C
```

### Evidência literal — tentativas C++ do watchdog da UI

```text
crossOriginIsolated = true
phase:compiling
UI watchdog expired at 20000ms; worker terminated.
```

Esse resultado ocorreu para `hello.cpp`, `vector.cpp` e `exceptions.cpp`. O browser não recebeu exit code do compilador: o worker foi encerrado enquanto ainda estava em `phase:compiling`. Numa tentativa anterior de `hello.cpp` com `-O2`, sem o watchdog curto final, o worker permaneceu compilando até o limite externo de 240 s; o comando retornou exit code 137 após o sandbox ser fechado, sem artefato. O teste posterior com `-O0` foi interrompido em 20 s. Isso não identifica se o custo vem do parse/link da biblioteca C++, do target/sysroot desse pacote ou de outro bloqueio interno; essa causa permanece **não determinada**.

O teste do alias `clang++` retornou em 8.231 ms:

```text
ERROR: command `clang++` was not found in the installed packages
```

### Evidência literal — erro de sintaxe

Código inserido no editor:

```c
int main( {
  return 0;
}
```

Stderr recebido do compilador:

```text
/workspace/main.c:1:11: error: expected parameter declarator
int main( {
          ^
/workspace/main.c:1:11: error: expected ')'
/workspace/main.c:1:9: note: to match this '('
int main( {
        ^
/workspace/main.c:3:2: error: expected function body after function declarator
}
 ^
3 errors generated.
```

### Evidência literal — Stop

```text
crossOriginIsolated = true
phase:compiling
CANCELLED by user; compiler Worker terminated after 1540ms.
```

Após Stop, Run ficou habilitado, Stop desabilitado, e o JSON mostrou `{"status":"cancelled","durationMs":1540,"action":"Stop button terminated the compiler Worker"}`. Este é o cancelamento efetivamente verificado; os timers dentro do worker não são confiáveis enquanto o comando WASM o bloqueia, então o watchdog da página é quem garante a UI responsiva.

## Tamanho e cold/warm

- Artefato C gerado e medido no browser: `main.wasm` = 47.379 bytes com os flags `-O0 -g0`.
- Compilação C da primeira execução desta sessão: 1.003 ms; execução completa: 9.245 ms.
- Segunda execução C no mesmo Chromium: compilação 1.163 ms; total 2.274 ms. É uma comparação primeira/repetida observada, mas não prova um cold start limpo: não foram medidos bytes de rede nem estado do cache do SDK.
- O cache local preexistente em `spike/cpp/.wasmer/cache-v1/packages/c127b7bfc0041d02c94045f40be7fb4b3eeb98cede25fad96261b7b90a82f405.bin` mede 110.713.421 bytes. Esse arquivo já existia antes desta rodada; não o trato como medição do download feito pelo browser.
- Download frio do pacote, bytes transferidos e primeira inicialização realmente sem cache: **não medidos**.
- Tamanho do WASM para C++: **não medido/não produzido**.

## Comprovado

- A página abre isolada no Chromium testado (`crossOriginIsolated = true`).
- `clang` compila `hello.c`, o módulo gerado importa os namespaces registrados acima e o runtime Wasmer do SDK executa `_start` com exit code 0 e stdout capturado.
- O runtime antigo era incompatível com os imports reais: fornecia o shim WASI Preview 1 para módulo que também importava `env` e `wasix_32v1`.
- A UI expõe progresso temporal, watchdog independente de 20 s e Stop observável que encerra o worker e libera os botões.
- Erro de sintaxe retorna exit code 1 e stderr do Clang.

## Falhou

- `hello.cpp`, `vector.cpp` e `exceptions.cpp` não compilaram dentro de 20 s; nenhum deles foi executado. Um teste anterior de `hello.cpp` também excedeu 230 s de compilação até o encerramento externo.
- `clang++` não existe nesse pacote. Usar o comando `clang` com extensão `.cpp`, `-std=c++17`, `-O0` e `-g0` ainda não gerou saída ou artefato dentro do watchdog.
- Logo, não há ciclo C++ funcional demonstrado e não declaro C++ funcional.

## Não testado

- Execução dos samples C++ e suporte real às exceções de `exceptions.cpp`.
- Se uma combinação diferente de sysroot/target/flags resolver a compilação C++ com esse pacote.
- Stdin, múltiplos arquivos, programas grandes, limite de memória e comportamento em outros browsers/dispositivos.
- Transferência fria do pacote, cache persistente real entre sessões e tamanho de download.

## Diagnóstico e menor alternativa

A falha inicial foi de integração runtime/imports. O shim `browser_wasi_shim` foi removido do harness e de `package.json`; a execução do artefato foi movida para o Wasmer SDK, que resolveu o caso C. A evidência não aponta para um erro de compilação/linkagem no sample C.

Para C++, o pacote atual `clang/clang` não demonstrou uma toolchain executável dentro de um limite aceitável: o alias `clang++` falta e as três amostras que exigem headers/biblioteca C++ travaram até o watchdog. Não é seguro inferir que só aumentar o timeout resolverá. A menor alternativa sem construir LLVM é substituir esse pacote por um bundle de toolchain já compilado que inclua driver C++, sysroot/libc++ e suporte a exceções, mantendo o mesmo contrato de execução Wasmer/WASIX; outra opção é um bundle Emscripten já pronto para browser. Escolher uma delas exige testar primeiro tamanho/licença, ABI e as mesmas três amostras, especialmente exceções. A disponibilidade de um pacote Wasmer C++ compatível não foi confirmada.

Referências do fornecedor consultadas: [artigo Wasmer sobre Clang no browser](https://wasmer.io/posts/clang-in-browser) (exemplo publicado focado em C e estimativa de pacote de ~100 MB) e [WASI SDK](https://github.com/WebAssembly/wasi-sdk) (distribui Clang/sysroot já construídos; não requer construir LLVM nesta tarefa).

## Verificações executadas

- `node --check index.js && node --check worker-compile.js && node --check server.mjs`: passou.
- Ruby YAML/JSON consistency check: analisou `pnpm-lock.yaml`, `package-lock.json` e `package.json`; confirmou `@wasmer/sdk` em `0.19.0` nos dois locks e ausência de `@bjorn3/browser_wasi_shim` como dependência/importer: passou.
- Chromium headless/Playwright em `http://127.0.0.1:4173/`: confirmou carregamento, isolamento, C exit 0/output esperado, erro C, os três watchdogs C++, repetição C, Stop, progresso visível (`crossOriginIsolated = true | 1s`), botões habilitados/desabilitados e ausência de `pageerror` no smoke final.
- `pnpm install --lockfile-only --frozen-lockfile --offline --store-dir /tmp/licode-spike-cpp-lock-store` não concluiu: o ambiente falhou ao abrir `pnpm-store-operation-locks` com `Read-only file system`. A validação direta do YAML/manifestos acima passou e não dependeu de escrever nos diretórios de operação do pnpm.
- Screenshot final de verificação: `/tmp/spike-cpp-final.png` (artefato temporário fora do repositório).

## Conclusão

O spike agora comprova compilar e executar **C** no Chromium, com diagnóstico de imports e encerramento observável. **C++ continua bloqueado** por compilação longa/não observável com o pacote testado; não há prova de execução C++. Não houve alteração fora de `spike/cpp/` e não houve integração ao produto.
