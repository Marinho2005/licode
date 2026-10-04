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

  // Batching state
  let batchBuffer = '';
  let batchTimer: number | null = null;

  export function writeLog(channel: 'stdout' | 'stderr' | 'system', text: string) {
    if (!term) return;

    let formatted = text.replace(/\n/g, '\r\n');
    // Previne duplicação de \r
    formatted = formatted.replace(/\r\r\n/g, '\r\n');

    let sequence = '';
    if (channel === 'stderr') {
      sequence = `\x1b[31m${formatted}\x1b[0m`;
    } else if (channel === 'system') {
      sequence = `\x1b[90;3m${formatted}\x1b[0m`;
    } else {
      sequence = formatted;
    }

    // Always add a newline after log entries since the old console appended divs per log.
    // Wait, if it's stdout, does the runtime send partial lines or full lines?
    // Python/Ruby usually send lines with \n, and Pyodide console sends full strings. 
    // Wait! In the old console: "white-space: pre-wrap", so we just dump the text. But the old console was making a new div for each `appendLog`.
    // We should append a newline to mimic the old `div` behavior if the incoming text isn't just chunks?
    // Let's check how the previous events were handled. The previous `appendLog` created a whole new div block per `appendLog`.
    // Wait, the sandbox actually sends stdout in chunks. If the previous one appended a div, it means `console.log` added `\n` in JS, but maybe Python `print` sent `\n` too.
    // We will NOT append `\r\n` automatically unless we know it's a discrete log message (like system messages).
    // The instructions say: "stdout normal, stderr em vermelho, mensagens do sistema em cinza/itálico".
    // I'll add \r\n to system messages just to be safe, or just rely on the sender adding \n.
    // Actually, "Iniciando sessão de execução" has no \n. So I should append \r\n to all messages if they don't have it? Or just let it be. Let's append \r\n.
    // Wait, `term.write` doesn't append newlines. I'll just append \r\n.

    batchBuffer += sequence;
    if (channel === 'system') {
      batchBuffer += '\r\n';
    }

    if (!batchTimer) {
      batchTimer = requestAnimationFrame(() => {
        term.write(batchBuffer);
        batchBuffer = '';
        batchTimer = null;
      });
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


  onMount(() => {
    term = new Terminal({
      disableStdin: true,
      scrollback: 5000,
      fontFamily: "'Fira Code', Consolas, monospace",
      fontSize: 14,
      theme: {
        background: '#090d13',
        foreground: '#c9d1d9',
      }
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    if (dev && browser) { (window as any).__xterm = term; }

    term.open(terminalContainer);
    fitAddon.fit();

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
  <div class="panel-header">
    <span>Terminal</span>
    <button class="btn btn-clear" onclick={onClear}>Limpar</button>
  </div>
  <div class="console-body" bind:this={terminalContainer}>
  </div>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
  }

  .output-panel {
    background: #090d13;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 14px;
    background: #161b22;
    border-bottom: 1px solid #21262d;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .btn-clear {
    background: transparent;
    border: 1px solid #30363d;
    color: #8b949e;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.82rem;
    cursor: pointer;
  }
  .btn-clear:hover {
    color: #c9d1d9;
    border-color: #8b949e;
  }

  .console-body {
    flex: 1;
    overflow: hidden; /* xterm will handle scroll */
    padding: 4px;
  }
  
  :global(.xterm .xterm-viewport) {
    overflow-y: auto !important;
  }
</style>
