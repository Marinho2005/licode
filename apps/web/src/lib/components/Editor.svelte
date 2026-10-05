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

  let textareaRef: HTMLTextAreaElement | null = $state(null);
  let gutterRef: HTMLDivElement | null = $state(null);

  // Calcula contagem de linhas
  const lineCount = $derived(Math.max(code.split('\n').length, 1));
  const linesArray = $derived(Array.from({ length: lineCount }, (_, i) => i + 1));

  function handleScroll(e: Event) {
    const target = e.currentTarget as HTMLTextAreaElement;
    if (gutterRef) {
      gutterRef.scrollTop = target.scrollTop;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // Atalho Ctrl+Enter ou Cmd+Enter para rodar
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isRunDisabled) {
        onRun();
      }
      return;
    }

    // Suporte a indentação com tecla Tab (2 espaços)
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!textareaRef) return;

      const start = textareaRef.selectionStart;
      const end = textareaRef.selectionEnd;
      const spaces = '  ';

      code = code.substring(0, start) + spaces + code.substring(end);

      // Restaura posição do cursor após re-render
      setTimeout(() => {
        if (textareaRef) {
          textareaRef.selectionStart = textareaRef.selectionEnd = start + spaces.length;
        }
      }, 0);
    }
  }

  function getLangColor(name: string) {
    if (name.endsWith('.ts')) return '#3178c6';
    if (name.endsWith('.js')) return '#f7df1e';
    if (name.endsWith('.py')) return '#38bdf8';
    if (name.endsWith('.rb')) return '#f43f5e';
    if (name.endsWith('.c')) return '#a8b9cc';
    return '#a1a1aa';
  }
</script>

<section class="panel editor-panel">
  <!-- Tabs Bar (VS Code Style) -->
  <div class="tabs-bar">
    <div class="tab active-tab">
      <span class="tab-indicator" style="background: {getLangColor(entryFile)};"></span>
      <span class="entry-file-label">{entryFile}</span>
      <span class="tab-close-icon">×</span>
    </div>

    <!-- Actions in tab bar -->
    <div class="tab-actions">
      <button
        type="button"
        class="tab-btn-action btn-run"
        disabled={isRunDisabled}
        onclick={onRun}
        title="Executar (Ctrl+Enter)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        <span>Run</span>
      </button>

      <button
        type="button"
        class="tab-btn-action btn-stop"
        disabled={isStopDisabled}
        onclick={onStop}
        title="Parar execução"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
        <span>Stop</span>
      </button>
    </div>
  </div>

  <!-- Breadcrumbs Bar (Replit style) -->
  <div class="breadcrumb-bar">
    <span class="breadcrumb-root">workspace</span>
    <span class="breadcrumb-sep">&gt;</span>
    <span class="breadcrumb-file">{entryFile}</span>
    <span class="lang-tag">{languageLabel}</span>
  </div>

  <!-- Editor Container with Gutter & Textarea -->
  <div class="editor-container">
    <div class="line-numbers-gutter" bind:this={gutterRef} aria-hidden="true">
      {#each linesArray as lineNum}
        <div class="line-num">{lineNum}</div>
      {/each}
    </div>

    <textarea
      bind:this={textareaRef}
      class="code-textarea"
      bind:value={code}
      onscroll={handleScroll}
      onkeydown={handleKeydown}
      placeholder="Digite ou cole seu código {languageLabel} aqui..."
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
    ></textarea>
  </div>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
    background: #18181b;
  }

  .editor-panel {
    border-right: 1px solid #27272a;
    position: relative;
  }

  /* Tabs Bar */
  .tabs-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    background: #121214;
    border-bottom: 1px solid #27272a;
    padding-left: 0;
    user-select: none;
    box-sizing: border-box;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 100%;
    padding: 0 14px;
    font-size: 0.8rem;
    font-family: 'Fira Code', Consolas, monospace;
    color: #a1a1aa;
    background: #18181b;
    border-right: 1px solid #27272a;
    border-top: 2px solid transparent;
    cursor: default;
  }

  .active-tab {
    color: #f4f4f5;
    background: #18181b;
    border-top-color: #38bdf8;
    font-weight: 500;
  }

  .tab-indicator {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .entry-file-label {
    letter-spacing: -0.01em;
  }

  .tab-close-icon {
    font-size: 1rem;
    color: #71717a;
    margin-left: 4px;
  }

  .tab-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-right: 10px;
  }

  .tab-btn-action {
    display: flex;
    align-items: center;
    gap: 5px;
    border: none;
    border-radius: 4px;
    padding: 3px 10px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tab-btn-action:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .btn-run {
    background: #10b98122;
    color: #34d399;
    border: 1px solid #10b98144;
  }
  .btn-run:hover:not(:disabled) {
    background: #10b98144;
    color: #ffffff;
  }

  .btn-stop {
    background: #ef444422;
    color: #f87171;
    border: 1px solid #ef444444;
  }
  .btn-stop:hover:not(:disabled) {
    background: #ef444444;
    color: #ffffff;
  }

  /* Breadcrumbs */
  .breadcrumb-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 12px;
    background: #18181b;
    border-bottom: 1px solid #27272a;
    font-size: 0.72rem;
    color: #71717a;
    user-select: none;
  }

  .breadcrumb-root { color: #a1a1aa; }
  .breadcrumb-sep { font-size: 0.65rem; color: #52525b; }
  .breadcrumb-file { color: #e4e4e7; font-family: monospace; }
  .lang-tag {
    margin-left: auto;
    font-size: 0.65rem;
    background: #27272a;
    padding: 1px 6px;
    border-radius: 4px;
    color: #a1a1aa;
  }

  /* Editor Main Area */
  .editor-container {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
    background: #18181b;
  }

  .line-numbers-gutter {
    width: 44px;
    background: #18181b;
    border-right: 1px solid #27272a55;
    padding: 12px 0;
    user-select: none;
    overflow: hidden;
    flex-shrink: 0;
    text-align: right;
  }

  .line-num {
    padding-right: 10px;
    font-family: 'Fira Code', Consolas, Monaco, monospace;
    font-size: 0.88rem;
    line-height: 1.55rem;
    color: #52525b;
  }

  .code-textarea {
    flex: 1;
    background: #18181b;
    color: #f4f4f5;
    border: none;
    padding: 12px 14px;
    font-family: 'Fira Code', Consolas, Monaco, monospace;
    font-size: 0.88rem;
    line-height: 1.55rem;
    resize: none;
    outline: none;
    white-space: pre;
    overflow-x: auto;
    overflow-y: auto;
    tab-size: 2;
    box-sizing: border-box;
  }

  .code-textarea::placeholder {
    color: #52525b;
  }
</style>
