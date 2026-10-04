<script lang="ts">
  export interface OutputLine {
    id: number;
    channel: 'stdout' | 'stderr' | 'system';
    text: string;
  }

  let {
    lines,
    onClear
  }: {
    lines: OutputLine[];
    onClear: () => void;
  } = $props();
</script>

<section class="panel output-panel">
  <div class="panel-header">
    <span>Console de Saída</span>
    <button class="btn btn-clear" onclick={onClear}>Limpar</button>
  </div>
  <div class="console-body">
    {#if lines.length === 0}
      <div class="empty-state">Nenhuma saída ainda. Clique em "Run" para executar.</div>
    {:else}
      {#each lines as line (line.id)}
        <div class="log-line log-{line.channel}">
          {#if line.channel === 'stderr'}
            <span class="gutter error">err</span>
          {:else if line.channel === 'system'}
            <span class="gutter sys">sys</span>
          {:else}
            <span class="gutter out">out</span>
          {/if}
          <pre class="log-content">{line.text}</pre>
        </div>
      {/each}
    {/if}
  </div>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
    padding: 12px;
    overflow-y: auto;
    font-family: 'Fira Code', Consolas, monospace;
    font-size: 0.88rem;
  }

  .empty-state {
    color: #484f58;
    font-style: italic;
    padding: 12px;
  }

  .log-line {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 2px;
    line-height: 1.45;
  }

  .gutter {
    font-size: 0.7rem;
    padding: 1px 4px;
    border-radius: 3px;
    text-transform: uppercase;
    font-weight: 700;
    user-select: none;
  }

  .gutter.out { background: #21262d; color: #58a6ff; }
  .gutter.error { background: #f8514933; color: #f85149; }
  .gutter.sys { background: #30363d; color: #8b949e; }

  .log-content {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    flex: 1;
  }

  .log-stdout .log-content {
    color: #c9d1d9;
  }

  .log-stderr .log-content {
    color: #ff7b72;
  }

  .log-system .log-content {
    color: #8b949e;
    font-style: italic;
  }
</style>
