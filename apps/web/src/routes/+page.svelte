<script lang="ts">
  import { onMount } from 'svelte';
  import type { ExecEvent } from '@licode/protocol';
  import type { ExecutionSession, RuntimeState } from '@licode/runtime-core';
  import { createIDEEnvironment } from '$lib/runtime-service.js';
  import { DEFAULT_SANDBOX_URL } from '$lib/config.js';
  import {
    LANGUAGES,
    getLanguageProfile,
    DEFAULT_LANGUAGE_ID,
    type LanguageProfile
  } from '$lib/languages.js';

  import Header from '$lib/components/Header.svelte';
  import PresetsBar from '$lib/components/PresetsBar.svelte';
  import Editor from '$lib/components/Editor.svelte';
  import Output, { type OutputLine } from '$lib/components/Output.svelte';

  let iframeElement = $state<HTMLIFrameElement | null>(null);
  let sandboxUrl = $state(DEFAULT_SANDBOX_URL);
  let selectedLanguageId = $state<string>(DEFAULT_LANGUAGE_ID);

  const currentProfile = $derived<LanguageProfile>(getLanguageProfile(selectedLanguageId));

  // Mapa em memória para reter as edições de código por linguagem
  const userCodes: Record<string, string> = {
    [DEFAULT_LANGUAGE_ID]: getLanguageProfile(DEFAULT_LANGUAGE_ID).examples[0].code
  };

  let code = $state(userCodes[DEFAULT_LANGUAGE_ID]);
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

  function changeLanguage(newLangId: string) {
    if (newLangId === selectedLanguageId && userCodes[newLangId] !== undefined) {
      return;
    }

    // Salva o texto editado pelo usuário na linguagem atual
    userCodes[selectedLanguageId] = code;

    selectedLanguageId = newLangId;
    const newProfile = getLanguageProfile(newLangId);

    // Se for a primeira vez, carrega o preset 1 (Hello World); senão restaura o texto salvo
    if (userCodes[newLangId] === undefined) {
      userCodes[newLangId] = newProfile.examples[0]?.code ?? '';
    }
    code = userCodes[newLangId];

    clearOutput();

    if (!newProfile.runtimeReady) {
      runtimeState = 'not-installed';
      return;
    }

    if (ideEnv) {
      runtimeState = ideEnv.manager.getState(newLangId);
      ideEnv.manager.prepare(newLangId).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        appendLog('stderr', `Falha ao inicializar runtime (${newProfile.label}): ${msg}`);
      });
    }
  }

  function loadPreset(presetId: string) {
    const example = currentProfile.examples.find((p) => p.id === presetId);
    if (example) {
      code = example.code;
      userCodes[selectedLanguageId] = code;
      clearOutput();
    }
  }

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const paramUrl = params.get('sandboxUrl');
    if (paramUrl) {
      sandboxUrl = paramUrl;
    }

    const paramLang = params.get('lang');
    if (paramLang) {
      changeLanguage(paramLang);
    }

    if (new URL(sandboxUrl, location.href).origin === location.origin) {
      runtimeState = 'error';
      appendLog('stderr', 'Erro de segurança: Sandbox não pode rodar na mesma origem.');
      setTimeout(() => {
        throw new Error('Sandbox não pode rodar na mesma origem');
      }, 0);
      return;
    }

    if (!iframeElement) return;

    ideEnv = createIDEEnvironment(iframeElement, sandboxUrl);
    (window as unknown as { __licode_ide?: unknown }).__licode_ide = ideEnv;

    ideEnv.manager.onStateChange((id: string, state: RuntimeState) => {
      if (id === selectedLanguageId) {
        runtimeState = state;
      }
    });

    if (currentProfile.runtimeReady) {
      ideEnv.manager.prepare(selectedLanguageId).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        appendLog('stderr', `Falha ao inicializar runtime: ${msg}`);
      });
    }
  });

  async function handleRun() {
    if (!ideEnv || execPhase !== 'idle') return;

    if (!currentProfile.runtimeReady) {
      appendLog('stderr', `Runtime para ${currentProfile.label} ainda não está disponível.`);
      return;
    }

    clearOutput();
    exitStatus = null;
    execPhase = 'compiling';
    appendLog('system', `--- Iniciando sessão de execução (${currentProfile.label}) ---`);

    try {
      const session = await ideEnv.manager.startSession(currentProfile.id, {
        files: { [currentProfile.entryFile]: code },
        entry: currentProfile.entryFile,
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
</script>

<div class="app-container">
  <Header
    {runtimeState}
    {execPhase}
    {exitStatus}
    runtimeLabel={currentProfile.runtimeLabel}
  />

  <div class="lang-selector">
    <label class="lang-label" for="select-language">
      Linguagem:
      <select
        id="select-language"
        class="lang-select"
        value={selectedLanguageId}
        onchange={(e) => changeLanguage((e.currentTarget as HTMLSelectElement).value)}
      >
        {#each LANGUAGES as lang}
          <option value={lang.id}>
            {lang.label}
          </option>
        {/each}
      </select>
    </label>
  </div>

  <PresetsBar presets={currentProfile.examples} onSelect={loadPreset} />

  <main class="main-layout">
    <Editor
      bind:code
      entryFile={currentProfile.entryFile}
      languageLabel={currentProfile.label}
      isRunDisabled={execPhase !== 'idle' || runtimeState !== 'ready' || !currentProfile.runtimeReady}
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

  .lang-selector {
    padding: 8px 18px;
    background: #0d1117;
    border-bottom: 1px solid #21262d;
    display: flex;
    align-items: center;
  }

  .lang-label {
    font-size: 0.85rem;
    color: #8b949e;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .lang-select {
    background: #21262d;
    color: #f0f6fc;
    padding: 5px 10px;
    border-radius: 6px;
    border: 1px solid #30363d;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    outline: none;
  }

  .lang-select:focus {
    border-color: #58a6ff;
  }
</style>
