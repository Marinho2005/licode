<script lang="ts">
  let {
    code = $bindable(),
    entryFile = 'index.js',
    languageLabel = 'JavaScript',
    isRunDisabled,
    isStopDisabled,
    onRun,
    onStop
  }: {
    code: string;
    entryFile?: string;
    languageLabel?: string;
    isRunDisabled: boolean;
    isStopDisabled: boolean;
    onRun: () => void;
    onStop: () => void;
  } = $props();
</script>

<section class="panel editor-panel">
  <div class="panel-header">
    <span class="entry-file-label">{entryFile}</span>
    <div class="actions">
      <button
        class="btn btn-run"
        disabled={isRunDisabled}
        onclick={onRun}
      >
        ▶ Run
      </button>
      <button
        class="btn btn-stop"
        disabled={isStopDisabled}
        onclick={onStop}
      >
        ⏹ Stop
      </button>
    </div>
  </div>
  <textarea
    class="code-textarea"
    bind:value={code}
    placeholder="Digite ou cole seu código {languageLabel} aqui..."
    spellcheck="false"
  ></textarea>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .editor-panel {
    border-right: 1px solid #30363d;
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

  .actions {
    display: flex;
    gap: 8px;
  }

  .btn {
    border: none;
    border-radius: 6px;
    padding: 5px 14px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-run {
    background: #238636;
    color: #ffffff;
  }
  .btn-run:hover:not(:disabled) {
    background: #2ea043;
  }

  .btn-stop {
    background: #da3633;
    color: #ffffff;
  }
  .btn-stop:hover:not(:disabled) {
    background: #f85149;
  }

  .code-textarea {
    flex: 1;
    background: #0d1117;
    color: #f0f6fc;
    border: none;
    padding: 14px;
    font-family: 'Fira Code', 'Cascadia Code', Consolas, Monaco, monospace;
    font-size: 0.95rem;
    line-height: 1.5;
    resize: none;
    outline: none;
  }
</style>
