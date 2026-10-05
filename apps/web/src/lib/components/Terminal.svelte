<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser, dev } from '$app/environment';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import '@xterm/xterm/css/xterm.css';

  export interface LogEvent {
    channel: 'stdout' | 'stderr' | 'system';
    text: string;
  }

  let terminalContainer: HTMLDivElement;
  let term: Terminal;
  let fitAddon: FitAddon;
  let resizeObserver: ResizeObserver;

  // Batching & queue state
  let batchBuffer = '';
  let batchTimer: number | null = null;
  let pendingLogs: Array<{ channel: 'stdout' | 'stderr' | 'system'; text: string }> = [];

  let hasOutput = $state(false);
  let domLogs = $state<Array<{ channel: 'stdout' | 'stderr' | 'system'; text: string }>>([]);

  let {
    languageLabel = 'JavaScript',
    execPhase = 'idle',
    runCount = 0,
    onClear
  }: {
    languageLabel?: string;
    execPhase?: 'idle' | 'compiling' | 'running';
    runCount?: number;
    onClear: () => void;
  } = $props();

  const formattedRun = $derived(`RUN ${String(runCount).padStart(2, '0')}`);

  export function writeLog(channel: 'stdout' | 'stderr' | 'system', text: string) {
    hasOutput = true;
    domLogs = [...domLogs, { channel, text }];
    if (!term) {
      pendingLogs.push({ channel, text });
      return;
    }

    let formatted = text.replace(/\n/g, '\r\n');
    formatted = formatted.replace(/\r\r\n/g, '\r\n');

    let sequence = '';
    if (channel === 'stderr') {
      sequence = `\x1b[31m${formatted}\x1b[0m\r\n`;
    } else if (channel === 'system') {
      sequence = `\x1b[90;3m${formatted}\x1b[0m\r\n`;
    } else {
      sequence = formatted;
    }

    if (channel === 'stderr' || channel === 'system') {
      if (batchBuffer) {
        term.write(batchBuffer);
        batchBuffer = '';
        if (batchTimer) {
          cancelAnimationFrame(batchTimer);
          batchTimer = null;
        }
      }
      term.write(sequence);
    } else {
      batchBuffer += sequence;
      if (!batchTimer) {
        batchTimer = requestAnimationFrame(() => {
          if (term && batchBuffer) {
            term.write(batchBuffer);
          }
          batchBuffer = '';
          batchTimer = null;
        });
      }
    }
  }

  export function clear() {
    if (term) {
      term.clear();
      term.reset();
    }
    batchBuffer = '';
    hasOutput = false;
    domLogs = [];
  }

  export function refit() {
    if (fitAddon) {
      fitAddon.fit();
    }
  }

  onMount(() => {
    term = new Terminal({
      disableStdin: true,
      scrollback: 5000,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      theme: {
        background: '#0d0f12',
        foreground: '#e6edf3',
        cursor: '#e5a93c',
        black: '#161b22',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#e3b341',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#f0f6fc'
      }
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    if (dev && browser) {
      (window as any).__xterm = term;
    }

    term.open(terminalContainer);
    fitAddon.fit();

    if (pendingLogs.length > 0) {
      for (const item of pendingLogs) {
        writeLog(item.channel, item.text);
      }
      pendingLogs = [];
    }

    resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(terminalContainer);
  });

  onDestroy(() => {
    if (batchTimer) {
      cancelAnimationFrame(batchTimer);
    }
    if (resizeObserver && terminalContainer) {
      resizeObserver.unobserve(terminalContainer);
      resizeObserver.disconnect();
    }
    if (term) {
      term.dispose();
    }
  });
</script>

<section class="panel output-panel">
  <!-- Terminal Header matching prototype -->
  <div class="panel-header">
    <div class="header-left">
      <span class="prompt-icon">&gt;_</span>
      <span class="term-title">TERMINAL</span>
      <span class="term-lang">{languageLabel}</span>
    </div>

    <div class="header-right">
      <div class="timeout-info">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>limite de 3 s</span>
      </div>

      <button
        type="button"
        class="btn-clear"
        onclick={onClear}
        title="Limpar Terminal"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
          <path d="M21 3v5h-5"/>
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
          <path d="M8 16H3v5"/>
        </svg>
        <span>Limpar</span>
      </button>
    </div>
  </div>

  <!-- Subheader matching prototype: ● Aguardando execução ... RUN 00 -->
  <div class="sub-header-bar">
    <div class="status-phase-display">
      {#if execPhase === 'running'}
        <span class="dot-running">●</span>
        <span>Executando...</span>
      {:else if execPhase === 'compiling'}
        <span class="dot-compiling">●</span>
        <span>Compilando / Preparando...</span>
      {:else}
        <span class="dot-idle">●</span>
        <span>Aguardando execução</span>
      {/if}
    </div>
    <div class="run-counter-display">
      <span>{formattedRun}</span>
    </div>
  </div>

  <!-- Terminal Content Container -->
  <div class="terminal-workspace">
    {#if !hasOutput}
      <div class="empty-placeholder">
        <span>A saída do seu programa aparecerá aqui.</span>
      </div>
    {/if}

    <div class="console-body" bind:this={terminalContainer}></div>

    <!-- Floating / Docked Security Card matching prototype -->
    <div class="worker-security-card">
      <div class="security-card-header">
        <span class="green-dot">●</span>
        <strong>Worker isolado</strong>
      </div>
      <p class="security-card-desc">
        Worker descartável · origem separada · window, document e localStorage indisponíveis
      </p>
    </div>

    <!-- Hidden DOM mirror for automated E2E log inspection -->
    <div class="test-logs-mirror" style="position: absolute; opacity: 0; pointer-events: none; height: 0; overflow: hidden;" aria-hidden="true">
      {#each domLogs as log}
        <div class="log-line log-{log.channel}">
          <span class="log-content">{log.text}</span>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
    background: #0d0f12;
  }

  .output-panel {
    background: #0d0f12;
    position: relative;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 38px;
    padding: 0 14px;
    background: #0d0f12;
    border-bottom: 1px solid #1c2128;
    user-select: none;
    box-sizing: border-box;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .prompt-icon {
    color: #e5a93c;
    font-weight: 700;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 0.9rem;
  }

  .term-title {
    color: #e6edf3;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .term-lang {
    color: #6e7681;
    font-size: 0.78rem;
    margin-left: 2px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .timeout-info {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #6e7681;
    font-size: 0.74rem;
  }

  .btn-clear {
    background: #161b22;
    border: 1px solid #30363d;
    color: #c9d1d9;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 0.74rem;
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-clear:hover {
    color: #ffffff;
    border-color: #444c56;
    background: #21262d;
  }

  /* Subheader bar */
  .sub-header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 30px;
    padding: 0 14px;
    background: #0d0f12;
    border-bottom: 1px solid #1c2128;
    font-size: 0.74rem;
    user-select: none;
  }

  .status-phase-display {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #7d8590;
  }

  .dot-idle {
    color: #6e7681;
    font-size: 0.7rem;
  }

  .dot-running {
    color: #58a6ff;
    font-size: 0.7rem;
    animation: pulse 1s infinite;
  }

  .dot-compiling {
    color: #e5a93c;
    font-size: 0.7rem;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .run-counter-display {
    color: #6e7681;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 0.72rem;
  }

  /* Terminal Workspace Area */
  .terminal-workspace {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    background: #0d0f12;
  }

  .empty-placeholder {
    position: absolute;
    top: 14px;
    left: 14px;
    color: #484f58;
    font-size: 0.84rem;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    pointer-events: none;
    user-select: none;
    z-index: 2;
  }

  .console-body {
    flex: 1;
    overflow: hidden;
    padding: 6px 12px;
    background: #0d0f12;
  }

  /* Worker Security Card matching prototype */
  .worker-security-card {
    background: #11141a;
    border: 1px solid #232832;
    border-radius: 8px;
    padding: 10px 14px;
    margin: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .security-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #e6edf3;
    font-size: 0.78rem;
    margin-bottom: 4px;
  }

  .green-dot {
    color: #3fb950;
    font-size: 0.7rem;
    line-height: 1;
  }

  .security-card-desc {
    margin: 0;
    color: #7d8590;
    font-size: 0.72rem;
    line-height: 1.4;
  }

  :global(.xterm .xterm-viewport) {
    overflow-y: auto !important;
    background: #0d0f12 !important;
  }

  :global(.xterm) {
    padding: 4px 0;
  }
</style>
