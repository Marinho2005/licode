<script lang="ts">
  import { onMount } from 'svelte';
  import type { ExecEvent } from '@licode/protocol';
  import type { ExecutionSession, RuntimeState } from '@licode/runtime-core';
  import { createIDEEnvironment } from '$lib/runtime-service.js';
  import { DEFAULT_SANDBOX_URL } from '$lib/config.js';

  import Header from '$lib/components/Header.svelte';
  import PresetsBar from '$lib/components/PresetsBar.svelte';
  import Editor from '$lib/components/Editor.svelte';
  import Output, { type OutputLine } from '$lib/components/Output.svelte';

  const PRESETS: Record<string, { label: string; code: string }> = {
    hello: {
      label: '1. console.log("oi")',
      code: 'console.log("oi");'
    },
    timeout: {
      label: '2. while(true) (Timeout 3s)',
      code: `console.log("Iniciando loop infinito síncrono...");\nwhile (true) {\n  // bloqueia thread\n}`
    },
    outputLimit: {
      label: '3. Loop de Logs (Output Limit)',
      code: `console.log("Iniciando spam de console.log...");\nlet i = 0;\nwhile (true) {\n  console.log("linha de log de teste #" + (++i) + " - flood flood flood");\n}`
    },
    error: {
      label: '4. Throw de Erro',
      code: `console.log("Antes do throw");\nthrow new Error("Erro de execução simulado!");`
    },
    security: {
      label: '5. Isolamento (Escape Test)',
      code: `console.log("Tentando acessar window/document/localStorage...");\ntry {\n  console.log("window:", typeof window !== "undefined" ? window : "INACESSÍVEL");\n} catch (e: any) { console.error("window bloqueado:", e.message); }\n\ntry {\n  console.log("document:", typeof document !== "undefined" ? document : "INACESSÍVEL");\n} catch (e: any) { console.error("document bloqueado:", e.message); }\n\ntry {\n  console.log("localStorage:", typeof localStorage !== "undefined" ? localStorage : "INACESSÍVEL");\n} catch (e: any) { console.error("localStorage bloqueado:", e.message); }`
    },
    asyncInterval: {
      label: '6. Stop Interrompe',
      code: `console.log("Iniciando loop assíncrono. Clique em Stop para matar imediatamente!");\nlet count = 0;\nwhile (true) {\n  console.log("Tick #" + (++count));\n  await new Promise(r => setTimeout(r, 100));\n}`
    }
  };

  let iframeElement = $state<HTMLIFrameElement | null>(null);
  let sandboxUrl = $state(DEFAULT_SANDBOX_URL);
  let code = $state(PRESETS.hello.code);
  let runtimeState = $state<RuntimeState | 'error'>('not-installed');
  let execPhase = $state<'idle' | 'compiling' | 'running'>('idle');
  let exitStatus = $state<{ code: number; reason?: string } | null>(null);
  let outputLines = $state<OutputLine[]>([]);
  let currentSession = $state<ExecutionSession | null>(null);
  let nextLineId = 0;

  let ideEnv: ReturnType<typeof createIDEEnvironment> | null = null;

  function appendLog(channel: 'stdout' | 'stderr' | 'system', text: string) {
    outputLines = [...outputLines, { id: ++nextLineId, channel, text }];
  }

  function clearOutput() {
    outputLines = [];
    exitStatus = null;
  }

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const paramUrl = params.get('sandboxUrl');
    if (paramUrl) {
      sandboxUrl = paramUrl;
    }

    const sandboxOrigin = new URL(sandboxUrl, window.location.origin).origin;
    if (sandboxOrigin === window.location.origin) {
      runtimeState = 'error';
      appendLog('stderr', 'Erro de segurança: Sandbox não pode rodar na mesma origem.');
      throw new Error('Sandbox não pode rodar na mesma origem');
    }

    if (!iframeElement) return;

    ideEnv = createIDEEnvironment(iframeElement, sandboxUrl);
    ideEnv.manager.onStateChange((_id: string, state: RuntimeState) => {
      runtimeState = state;
    });

    // Pré-aquece o runtime JS
    ideEnv.manager.prepare('javascript').catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog('stderr', `Falha ao inicializar runtime: ${msg}`);
    });
  });

  async function handleRun() {
    if (!ideEnv || execPhase !== 'idle') return;

    clearOutput();
    exitStatus = null;
    execPhase = 'compiling';
    appendLog('system', '--- Iniciando sessão de execução ---');

    try {
      const session = await ideEnv.manager.startSession('javascript', {
        files: { 'index.js': code },
        entry: 'index.js',
        limits: { wallMs: 3000 }
      });
      currentSession = session;

      (async () => {
        try {
          for await (const event of session.events) {
            if (event.t === 'phase') {
              execPhase = event.phase;
            } else if (event.t === 'stdout') {
              appendLog('stdout', event.data);
            } else if (event.t === 'stderr') {
              appendLog('stderr', event.data);
            } else if (event.t === 'exit') {
              exitStatus = { code: event.code, reason: event.reason };
              execPhase = 'idle';
              currentSession = null;
              appendLog(
                'system',
                `--- Execução finalizada (Exit Code: ${event.code}${event.reason ? `, Motivo: ${event.reason}` : ''}) ---`
              );
            }
          }
        } catch (err: unknown) {
          appendLog('stderr', `Erro no fluxo de eventos: ${err instanceof Error ? err.message : String(err)}`);
          execPhase = 'idle';
          currentSession = null;
        }
      })();
    } catch (err: unknown) {
      appendLog('stderr', `Falha ao iniciar: ${err instanceof Error ? err.message : String(err)}`);
      execPhase = 'idle';
      currentSession = null;
    }
  }

  async function handleStop() {
    if (!currentSession) return;
    appendLog('system', 'Enviando sinal SIGKILL...');
    await currentSession.signal('SIGKILL');
  }

  function loadPreset(key: string) {
    if (PRESETS[key]) {
      code = PRESETS[key].code;
      clearOutput();
    }
  }
</script>

<div class="app-container">
  <Header {runtimeState} {execPhase} {exitStatus} />

  <PresetsBar presets={PRESETS} onSelect={loadPreset} />

  <main class="main-layout">
    <Editor
      bind:code
      isRunDisabled={execPhase !== 'idle' || runtimeState !== 'ready'}
      isStopDisabled={execPhase === 'idle'}
      onRun={handleRun}
      onStop={handleStop}
    />

    <Output lines={outputLines} onClear={clearOutput} />
  </main>

  {#if runtimeState !== 'error'}
    <iframe
      bind:this={iframeElement}
      src={sandboxUrl}
      sandbox="allow-scripts allow-same-origin"
      title="LiCode Sandbox Host"
      class="sandbox-iframe"
    ></iframe>
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    background: #0d1117;
    color: #c9d1d9;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .main-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    flex: 1;
    overflow: hidden;
  }

  .sandbox-iframe {
    position: absolute;
    width: 0;
    height: 0;
    border: none;
    visibility: hidden;
  }
</style>
