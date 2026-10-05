<script lang="ts">
  let {
    code = $bindable(),
    entryFile = 'main.js',
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

  let cursorLine = $state(1);
  let cursorCol = $state(1);

  // Calcula contagem de linhas
  const lineCount = $derived(Math.max(code.split('\n').length, 1));
  const linesArray = $derived(Array.from({ length: lineCount }, (_, i) => i + 1));

  function updateCursor() {
    if (!textareaRef) return;
    const pos = textareaRef.selectionStart || 0;
    const beforeCursor = code.substring(0, pos);
    const lines = beforeCursor.split('\n');
    cursorLine = lines.length;
    cursorCol = lines[lines.length - 1].length + 1;
  }

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

      setTimeout(() => {
        if (textareaRef) {
          textareaRef.selectionStart = textareaRef.selectionEnd = start + spaces.length;
          updateCursor();
        }
      }, 0);
      return;
    }

    setTimeout(updateCursor, 0);
  }
</script>

<section class="panel editor-panel">
  <!-- Tabs Bar matching prototype -->
  <div class="tabs-bar">
    <div class="tab active-tab">
      <svg class="tab-code-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/>
        <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>
      </svg>
      <span class="entry-file-label">{entryFile}</span>
    </div>

    <!-- Breadcrumb on right side of tab bar -->
    <div class="breadcrumb-container">
      <span class="breadcrumb-text">workspace &gt; {entryFile}</span>
    </div>
  </div>

  <!-- Subheader Bar (Language pill, encoding, mode notice) -->
  <div class="sub-header-bar">
    <div class="sub-header-left">
      <span class="lang-pill">{languageLabel}</span>
      <span class="encoding-text">UTF-8</span>
    </div>
    <div class="sub-header-right">
      <span class="mode-notice">Somente {languageLabel}</span>
    </div>
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
      onclick={updateCursor}
      onkeyup={updateCursor}
      placeholder="Digite ou cole seu código {languageLabel} aqui..."
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
    ></textarea>
  </div>

  <!-- Editor Footer Status matching prototype: {} main.js ... Ln 1, Col 19 -->
  <div class="editor-status-bar">
    <div class="editor-status-left">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/>
        <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>
      </svg>
      <span>{entryFile}</span>
    </div>
    <div class="editor-status-right">
      <span>Ln {cursorLine}, Col {cursorCol}</span>
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

  .editor-panel {
    border-right: 1px solid #1c2128;
    position: relative;
  }

  /* Tabs Bar matching prototype */
  .tabs-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 38px;
    background: #0d0f12;
    border-bottom: 1px solid #1c2128;
    user-select: none;
    box-sizing: border-box;
    padding-right: 14px;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 100%;
    padding: 0 16px;
    font-size: 0.8rem;
    font-family: 'JetBrains Mono', Consolas, monospace;
    color: #8b949e;
    background: #0d0f12;
    border-right: 1px solid #1c2128;
    cursor: default;
    position: relative;
  }

  .active-tab {
    color: #e6edf3;
    font-weight: 500;
    border-top: 2px solid #e5a93c;
  }

  .tab-code-icon {
    color: #e5a93c;
  }

  .entry-file-label {
    letter-spacing: -0.01em;
  }

  .breadcrumb-container {
    font-size: 0.74rem;
    color: #6e7681;
    font-family: 'JetBrains Mono', Consolas, monospace;
  }

  /* Subheader bar matching prototype */
  .sub-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 32px;
    padding: 0 14px;
    background: #0d0f12;
    border-bottom: 1px solid #1c2128;
    font-size: 0.74rem;
    user-select: none;
  }

  .sub-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .lang-pill {
    background: #161b22;
    border: 1px solid #282f3a;
    color: #c9d1d9;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 500;
  }

  .encoding-text {
    color: #6e7681;
    font-size: 0.72rem;
  }

  .sub-header-right {
    display: flex;
    align-items: center;
  }

  .mode-notice {
    color: #6e7681;
    font-size: 0.72rem;
  }

  /* Editor Main Area */
  .editor-container {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
    background: #0d0f12;
  }

  .line-numbers-gutter {
    width: 44px;
    background: #0d0f12;
    border-right: 1px solid rgba(28, 33, 40, 0.4);
    padding: 12px 0;
    user-select: none;
    overflow: hidden;
    flex-shrink: 0;
    text-align: right;
  }

  .line-num {
    padding-right: 12px;
    font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
    font-size: 0.88rem;
    line-height: 1.6rem;
    color: #484f58;
  }

  .code-textarea {
    flex: 1;
    background: #0d0f12;
    color: #e6edf3;
    border: none;
    padding: 12px 14px;
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace;
    font-size: 0.88rem;
    line-height: 1.6rem;
    resize: none;
    outline: none;
    white-space: pre;
    overflow-x: auto;
    overflow-y: auto;
    tab-size: 2;
    box-sizing: border-box;
  }

  .code-textarea::placeholder {
    color: #30363d;
  }

  /* Bottom status inside editor pane */
  .editor-status-bar {
    height: 24px;
    background: #0d0f12;
    border-top: 1px solid #1c2128;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    font-size: 0.72rem;
    color: #6e7681;
    user-select: none;
  }

  .editor-status-left {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: 'JetBrains Mono', Consolas, monospace;
  }

  .editor-status-right {
    font-family: 'JetBrains Mono', Consolas, monospace;
  }
</style>
