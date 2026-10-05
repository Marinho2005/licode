<script lang="ts">
  import type { LanguageProfile, CodePreset } from '$lib/languages.js';
  import type { RuntimeState } from '@licode/runtime-core';

  let {
    activeTab = 'explorer',
    width = $bindable(260),
    isOpen = true,
    languages,
    selectedLanguageId,
    currentProfile,
    runtimeState,
    onSelectLanguage,
    onSelectPreset,
    onClose
  }: {
    activeTab: 'explorer' | 'presets' | 'settings';
    width: number;
    isOpen: boolean;
    languages: LanguageProfile[];
    selectedLanguageId: string;
    currentProfile: LanguageProfile;
    runtimeState: RuntimeState | 'error';
    onSelectLanguage: (id: string) => void;
    onSelectPreset: (id: string) => void;
    onClose: () => void;
  } = $props();

  let isResizing = $state(false);

  function startResize(e: PointerEvent) {
    e.preventDefault();
    isResizing = true;

    const startX = e.clientX;
    const startWidth = width;

    function onPointerMove(moveEvent: PointerEvent) {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + delta, 180), 550);
      width = newWidth;
    }

    function onPointerUp() {
      isResizing = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  function getFileIcon(langId: string) {
    if (langId === 'javascript') return { ext: 'JS', color: '#f7df1e' };
    if (langId === 'typescript') return { ext: 'TS', color: '#3178c6' };
    if (langId === 'python') return { ext: 'PY', color: '#38bdf8' };
    if (langId === 'ruby') return { ext: 'RB', color: '#f43f5e' };
    if (langId === 'c') return { ext: 'C', color: '#a8b9cc' };
    return { ext: '<>', color: '#a1a1aa' };
  }
</script>

{#if isOpen}
  <aside
    class="sidebar"
    style="width: {width}px;"
    class:resizing={isResizing}
    aria-label="Barra Lateral"
  >
    <div class="sidebar-header">
      <span class="sidebar-title">
        {#if activeTab === 'explorer'}
          EXPLORADOR
        {:else if activeTab === 'presets'}
          EXEMPLOS & SNIPPETS
        {:else}
          CONFIGURAÇÕES
        {/if}
      </span>
      <button
        type="button"
        class="icon-btn"
        title="Ocultar barra lateral"
        onclick={onClose}
        aria-label="Ocultar"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>
    </div>

    <div class="sidebar-content">
      {#if activeTab === 'explorer'}
        <!-- Files section -->
        <div class="section-group">
          <div class="section-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m6 9 6 6 6-6"/>
            </svg>
            <span>WORKSPACE (ARQUIVOS)</span>
          </div>
          <div class="file-tree">
            {#each languages as lang}
              {@const icon = getFileIcon(lang.id)}
              <button
                type="button"
                class="file-item"
                class:active={lang.id === selectedLanguageId}
                onclick={() => onSelectLanguage(lang.id)}
              >
                <span class="file-badge" style="color: {icon.color}; border-color: {icon.color}44;">
                  {icon.ext}
                </span>
                <span class="file-name">{lang.entryFile}</span>
                {#if lang.id === selectedLanguageId}
                  <span class="active-dot" title="Arquivo ativo">●</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Language Selector Section (Preserves #select-language for tests) -->
        <div class="section-group">
          <div class="section-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m6 9 6 6 6-6"/>
            </svg>
            <span>LINGUAGEM ATIVA</span>
          </div>
          <div class="lang-selector-container">
            <label class="lang-label" for="select-language">
              <span>Seletor:</span>
              <select
                id="select-language"
                class="lang-select"
                value={selectedLanguageId}
                onchange={(e) => onSelectLanguage((e.currentTarget as HTMLSelectElement).value)}
              >
                {#each languages as lang}
                  <option value={lang.id}>{lang.label}</option>
                {/each}
              </select>
            </label>
            <div class="runtime-status-pill">
              <span class="state-dot state-{runtimeState}"></span>
              <span class="runtime-text">{currentProfile.runtimeLabel}: {runtimeState}</span>
            </div>
          </div>
        </div>

        <!-- Quick Presets Section in Explorer (Preserves .preset-btn for tests) -->
        <div class="section-group">
          <div class="section-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m6 9 6 6 6-6"/>
            </svg>
            <span>EXEMPLOS RÁPIDOS</span>
          </div>
          <div class="presets-list">
            {#each currentProfile.examples as preset}
              <button
                type="button"
                class="preset-btn"
                onclick={() => onSelectPreset(preset.id)}
              >
                <span class="preset-icon">⚡</span>
                <span class="preset-name">{preset.label}</span>
              </button>
            {/each}
          </div>
        </div>

      {:else if activeTab === 'presets'}
        <div class="section-group">
          <div class="section-title">
            <span>PRESETS PARA {currentProfile.label.toUpperCase()}</span>
          </div>
          <div class="presets-list">
            {#each currentProfile.examples as preset}
              <button
                type="button"
                class="preset-btn full-preset"
                onclick={() => onSelectPreset(preset.id)}
              >
                <div class="full-preset-header">
                  <strong>{preset.label}</strong>
                </div>
                <pre class="preset-snippet"><code>{preset.code.split('\n')[0]}</code></pre>
              </button>
            {/each}
          </div>
        </div>

      {:else if activeTab === 'settings'}
        <div class="section-group">
          <div class="section-title">
            <span>CONFIGURAÇÕES DE EXECUÇÃO</span>
          </div>
          <div class="settings-box">
            <div class="setting-item">
              <span class="setting-key">Watchdog Timeout:</span>
              <span class="setting-val">3.000 ms</span>
            </div>
            <div class="setting-item">
              <span class="setting-key">Quota de Output:</span>
              <span class="setting-val">256 KB (Flush 16ms)</span>
            </div>
            <div class="setting-item">
              <span class="setting-key">Isolamento:</span>
              <span class="setting-val text-green">Web Worker + Wasm</span>
            </div>
            <div class="setting-item">
              <span class="setting-key">Same-Origin Policy:</span>
              <span class="setting-val text-green">Origens Estritas (:8081)</span>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Flexible Resize Handle -->
    <div
      class="resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar barra lateral"
      onpointerdown={startResize}
    ></div>
  </aside>
{/if}

<style>
  .sidebar {
    background: #18181b;
    border-right: 1px solid #27272a;
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
    user-select: none;
    flex-shrink: 0;
    overflow: hidden;
  }

  .sidebar.resizing {
    user-select: none;
  }

  .sidebar-header {
    height: 38px;
    padding: 0 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #27272a;
    background: #18181b;
  }

  .sidebar-title {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #a1a1aa;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: #71717a;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .icon-btn:hover {
    color: #e4e4e7;
    background: #27272a;
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .section-group {
    margin-bottom: 16px;
  }

  .section-title {
    padding: 4px 12px;
    font-size: 0.68rem;
    font-weight: 700;
    color: #71717a;
    display: flex;
    align-items: center;
    gap: 6px;
    letter-spacing: 0.05em;
  }

  .file-tree {
    display: flex;
    flex-direction: column;
    margin-top: 4px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: transparent;
    border: none;
    color: #a1a1aa;
    font-size: 0.82rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
    width: 100%;
    box-sizing: border-box;
  }

  .file-item:hover {
    background: #27272a;
    color: #f4f4f5;
  }

  .file-item.active {
    background: #27272a88;
    color: #38bdf8;
    font-weight: 500;
    border-left: 2px solid #38bdf8;
    padding-left: 12px;
  }

  .file-badge {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid;
    font-family: monospace;
  }

  .file-name {
    flex: 1;
    font-family: 'Fira Code', Consolas, monospace;
    font-size: 0.8rem;
  }

  .active-dot {
    color: #38bdf8;
    font-size: 0.7rem;
  }

  .lang-selector-container {
    padding: 6px 12px;
  }

  .lang-label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.75rem;
    color: #a1a1aa;
  }

  .lang-select {
    background: #27272a;
    color: #f4f4f5;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 0.8rem;
    outline: none;
    cursor: pointer;
    width: 100%;
    box-sizing: border-box;
  }

  .lang-select:focus {
    border-color: #38bdf8;
  }

  .runtime-status-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 4px 8px;
    background: #27272a55;
    border-radius: 4px;
    font-size: 0.72rem;
    color: #a1a1aa;
  }

  .state-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .state-ready { background: #10b981; }
  .state-installing, .state-warming { background: #f59e0b; }
  .state-not-installed { background: #71717a; }
  .state-error { background: #ef4444; }

  .presets-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 10px;
  }

  .preset-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    padding: 6px 10px;
    color: #d4d4d8;
    font-size: 0.78rem;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    width: 100%;
    box-sizing: border-box;
  }

  .preset-btn:hover {
    background: #3f3f46;
    color: #ffffff;
    border-color: #52525b;
  }

  .preset-icon {
    font-size: 0.8rem;
    color: #eab308;
  }

  .preset-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .full-preset {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 8px 10px;
  }

  .preset-snippet {
    margin: 0;
    font-family: monospace;
    font-size: 0.7rem;
    color: #a1a1aa;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
  }

  .settings-box {
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    padding: 6px 0;
    border-bottom: 1px solid #27272a;
  }

  .setting-key { color: #a1a1aa; }
  .setting-val { color: #f4f4f5; font-family: monospace; }
  .text-green { color: #10b981; }

  /* Drag-to-Resize Handle */
  .resizer {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    background: transparent;
    transition: background 0.15s;
    z-index: 5;
  }

  .resizer:hover,
  .sidebar.resizing .resizer {
    background: #38bdf8;
  }
</style>
