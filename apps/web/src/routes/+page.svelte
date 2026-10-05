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
  import ActivityBar from '$lib/components/ActivityBar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import Editor from '$lib/components/Editor.svelte';
  import Terminal from '$lib/components/Terminal.svelte';

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
  let terminalRef: any = $state(null);
  let currentSession = $state<ExecutionSession | null>(null);

  let earlyLogs: Array<{ channel: 'stdout' | 'stderr' | 'system'; text: string }> = [];

  function appendLog(channel: 'stdout' | 'stderr' | 'system', text: string) {
    if (terminalRef) {
      terminalRef.writeLog(channel, text);
    } else {
      earlyLogs.push({ channel, text });
    }
  }

  $effect(() => {
    if (terminalRef && earlyLogs.length > 0) {
      for (const log of earlyLogs) {
        terminalRef.writeLog(log.channel, log.text);
      }
      earlyLogs = [];
    }
  });

  let ideEnv: ReturnType<typeof createIDEEnvironment> | null = null;

  // Layout states: ActivityBar, Sidebar, Workspace Resizer
  let activeActivityTab = $state<'explorer' | 'presets' | 'settings'>('explorer');
  let isSidebarOpen = $state(true);
  let sidebarWidth = $state(260);
  let editorSplitPercentage = $state(52); // Editor 52%, Terminal 48%
  let isWorkspaceResizing = $state(false);
  let runCount = $state(0);
  let isHelpModalOpen = $state(false);

  function clearOutput() {
    if (terminalRef) {
      terminalRef.clear();
    }
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

  function handleActivityTabClick(tab: 'explorer' | 'presets' | 'settings') {
    if (activeActivityTab === tab && isSidebarOpen) {
      isSidebarOpen = false;
    } else {
      activeActivityTab = tab;
      isSidebarOpen = true;
    }
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
  }

  // Divisor flexível entre Editor e Terminal
  function startWorkspaceResize(e: PointerEvent) {
    e.preventDefault();
    isWorkspaceResizing = true;

    const workspaceEl = document.querySelector('.main-workspace') as HTMLElement | null;
    if (!workspaceEl) return;

    const rect = workspaceEl.getBoundingClientRect();

    function onPointerMove(moveEvent: PointerEvent) {
      const offsetX = moveEvent.clientX - rect.left;
      const percentage = Math.min(Math.max((offsetX / rect.width) * 100, 20), 80);
      editorSplitPercentage = percentage;
      if (terminalRef?.refit) {
        terminalRef.refit();
      }
    }

    function onPointerUp() {
      isWorkspaceResizing = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (terminalRef?.refit) {
        terminalRef.refit();
      }
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
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

    const effectiveSandboxUrl = paramUrl || sandboxUrl;
    if (new URL(effectiveSandboxUrl, location.href).origin === location.origin) {
      console.error('[LiCode Security] Erro de segurança: Sandbox não pode rodar na mesma origem.');
      runtimeState = 'error';
      appendLog('stderr', 'Erro de segurança: Sandbox não pode rodar na mesma origem.');
      setTimeout(() => {
        throw new Error('Sandbox não pode rodar na mesma origem');
      }, 50);
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

    // Atalhos globais
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
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
    runCount += 1;
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
  <!-- Top Header (Replit / VS Code style) -->
  <Header
    {runtimeState}
    {execPhase}
    {exitStatus}
    runtimeLabel={currentProfile.runtimeLabel}
    isRunDisabled={execPhase !== 'idle' || runtimeState !== 'ready' || !currentProfile.runtimeReady}
    isStopDisabled={execPhase === 'idle'}
    onRun={handleRun}
    onStop={handleStop}
  />

  <!-- Main IDE Body -->
  <div class="workspace-body">
    <!-- Left Activity Bar (48px fixed) -->
    <ActivityBar
      activeTab={activeActivityTab}
      {isSidebarOpen}
      onTabClick={handleActivityTabClick}
      onOpenHelp={() => (isHelpModalOpen = true)}
    />

    <!-- Flexible Resizable Sidebar -->
    <Sidebar
      activeTab={activeActivityTab}
      bind:width={sidebarWidth}
      isOpen={isSidebarOpen}
      languages={LANGUAGES}
      {selectedLanguageId}
      {currentProfile}
      {runtimeState}
      onSelectLanguage={changeLanguage}
      onSelectPreset={loadPreset}
      onClose={() => (isSidebarOpen = false)}
    />

    <!-- Main Workspace (Editor + Splitter + Terminal) -->
    <main class="main-workspace" class:workspace-resizing={isWorkspaceResizing}>
      <div class="editor-pane" style="width: {editorSplitPercentage}%;">
        <Editor
          bind:code
          entryFile={currentProfile.entryFile}
          languageLabel={currentProfile.label}
          isRunDisabled={execPhase !== 'idle' || runtimeState !== 'ready' || !currentProfile.runtimeReady}
          isStopDisabled={execPhase === 'idle'}
          onRun={handleRun}
          onStop={handleStop}
        />
      </div>

      <!-- Draggable Splitter between Editor and Terminal -->
      <div
        class="workspace-splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="Ajustar proporção entre Editor e Terminal"
        onpointerdown={startWorkspaceResize}
      ></div>

      <div class="terminal-pane" style="width: {100 - editorSplitPercentage}%;">
        <Terminal
          bind:this={terminalRef}
          languageLabel={currentProfile.label}
          {execPhase}
          {runCount}
          onClear={clearOutput}
        />
      </div>
    </main>
  </div>

  <!-- Bottom Status Bar -->
  <StatusBar
    languageLabel={currentProfile.label}
    {runtimeState}
    {execPhase}
    {exitStatus}
    {isSidebarOpen}
    onToggleSidebar={toggleSidebar}
  />

  <!-- Help / Shortcuts Modal Dialog -->
  {#if isHelpModalOpen}
    <div
      class="modal-backdrop"
      onclick={() => (isHelpModalOpen = false)}
      onkeydown={(e) => e.key === 'Escape' && (isHelpModalOpen = false)}
      tabindex="0"
      role="button"
      aria-label="Fechar modal de ajuda"
    >
      <div
        class="modal-card"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        tabindex="-1"
        role="dialog"
        aria-modal="true"
      >
        <div class="modal-header">
          <h3>LiCode.dev · Ajuda e Atalhos</h3>
          <button
            type="button"
            class="modal-close-btn"
            onclick={() => (isHelpModalOpen = false)}
            aria-label="Fechar"
          >×</button>
        </div>
        <div class="modal-body">
          <div class="shortcut-list">
            <div class="shortcut-row">
              <span class="shortcut-action">Executar código</span>
              <kbd class="shortcut-key">⌘↵ / Ctrl+Enter</kbd>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-action">Alternar barra lateral</span>
              <kbd class="shortcut-key">Ctrl+B</kbd>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-action">Indentar código (2 espaços)</span>
              <kbd class="shortcut-key">Tab</kbd>
            </div>
          </div>
          <div class="help-info-box">
            <p>
              <strong>Isolamento Seguro:</strong> O código é executado em um Web Worker isolado em domínio próprio com política Same-Origin estrita. Não há acesso a <code>window</code>, <code>document</code> ou <code>localStorage</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Sandbox Iframe (Hidden / Isolated) -->
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
    background: #0d0f12;
    color: #e6edf3;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    user-select: none;
    overflow: hidden;
  }

  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: #0d0f12;
  }

  .workspace-body {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
    background: #0d0f12;
  }

  .main-workspace {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
    background: #0d0f12;
  }

  .main-workspace.workspace-resizing {
    user-select: none;
    cursor: col-resize;
  }

  .editor-pane {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .terminal-pane {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Draggable Splitter */
  .workspace-splitter {
    width: 1px;
    height: 100%;
    background: #1c2128;
    cursor: col-resize;
    flex-shrink: 0;
    position: relative;
    transition: background 0.15s;
    z-index: 5;
  }

  .workspace-splitter::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    right: -3px;
  }

  .workspace-splitter:hover,
  .main-workspace.workspace-resizing .workspace-splitter {
    background: #e5a93c;
  }

  .sandbox-iframe {
    position: absolute;
    width: 0;
    height: 0;
    border: none;
    visibility: hidden;
  }

  /* Help Modal */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }

  .modal-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 10px;
    width: 440px;
    max-width: 90vw;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid #21262d;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 0.95rem;
    color: #e6edf3;
    font-weight: 600;
  }

  .modal-close-btn {
    background: transparent;
    border: none;
    color: #8b949e;
    font-size: 1.3rem;
    line-height: 1;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .modal-close-btn:hover {
    color: #f0f6fc;
    background: #21262d;
  }

  .modal-body {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .shortcut-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.82rem;
  }

  .shortcut-action {
    color: #c9d1d9;
  }

  .shortcut-key {
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 4px;
    padding: 3px 8px;
    color: #e5a93c;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 0.76rem;
  }

  .help-info-box {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 0.76rem;
    color: #8b949e;
    line-height: 1.45;
  }

  .help-info-box strong {
    color: #e6edf3;
  }

  .help-info-box code {
    background: #161b22;
    padding: 1px 4px;
    border-radius: 3px;
    color: #e5a93c;
    font-family: monospace;
  }
</style>
