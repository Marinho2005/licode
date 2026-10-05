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

  export function writeLog(channel: 'stdout' | 'stderr' | 'system', text: string) {
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

  let {
    onClear
  }: {
    onClear: () => void;
  } = $props();

  export function clear() {
    if (term) {
      term.clear();
      term.reset();
    }
    batchBuffer = '';
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
      fontFamily: "'Fira Code', Consolas, Monaco, monospace",
      fontSize: 13,
      lineHeight: 1.3,
      theme: {
        background: '#09090b',
        foreground: '#e4e4e7',
        cursor: '#38bdf8',
        black: '#18181b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#f4f4f5'
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
  <!-- Terminal Tabs Bar (VS Code style) -->
  <div class="panel-header">
    <div class="tabs-group">
      <div class="term-tab active-term-tab">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
        <span>TERMINAL</span>
      </div>
      <div class="term-tab">
        <span>SAÍDA</span>
      </div>
    </div>

    <div class="term-actions">
      <button
        type="button"
        class="btn btn-clear"
        onclick={onClear}
        title="Limpar Terminal"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
        <span>Limpar</span>
      </button>
    </div>
  </div>

  <div class="console-body" bind:this={terminalContainer}></div>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
    background: #09090b;
  }

  .output-panel {
    background: #09090b;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 36px;
    padding: 0 10px;
    background: #121214;
    border-bottom: 1px solid #27272a;
    user-select: none;
    box-sizing: border-box;
  }

  .tabs-group {
    display: flex;
    align-items: center;
    height: 100%;
    gap: 4px;
  }

  .term-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 100%;
    padding: 0 10px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #71717a;
    border-bottom: 2px solid transparent;
    cursor: pointer;
  }

  .active-term-tab {
    color: #f4f4f5;
    border-bottom-color: #38bdf8;
  }

  .term-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-clear {
    background: transparent;
    border: 1px solid #27272a;
    color: #a1a1aa;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 0.72rem;
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-clear:hover {
    color: #f4f4f5;
    border-color: #3f3f46;
    background: #27272a;
  }

  .console-body {
    flex: 1;
    overflow: hidden;
    padding: 6px 8px;
  }

  :global(.xterm .xterm-viewport) {
    overflow-y: auto !important;
  }
</style>
