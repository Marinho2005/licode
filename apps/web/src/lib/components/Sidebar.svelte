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

  function getBadgeDetails(langId: string) {
    if (langId === 'javascript') {
      return { ext: 'JS', color: '#f1e05a', bg: '#2b2612', border: '#5c4e1b' };
    }
    if (langId === 'typescript') {
      return { ext: 'TS', color: '#3178c6', bg: '#102236', border: '#1e4875' };
    }
    if (langId === 'python') {
      return { ext: 'PY', color: '#38bdf8', bg: '#0d2538', border: '#1a4f78' };
    }
    if (langId === 'ruby') {
      return { ext: 'RB', color: '#f43f5e', bg: '#2e101a', border: '#661b31' };
    }
    if (langId === 'c') {
      return { ext: 'C', color: '#a8b9cc', bg: '#1c222b', border: '#354354' };
    }
    return { ext: '<>', color: '#8b949e', bg: '#161b22', border: '#30363d' };
  }

  const currentBadge = $derived(getBadgeDetails(selectedLanguageId));
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
          CONFIGURAÇÕES & SEGURANÇA
        {/if}
      </span>
      <button
        type="button"
        class="icon-btn"
        title="Ocultar barra lateral"
        onclick={onClose}
        aria-label="Ocultar"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M9 3v18" />
        </svg>
      </button>
    </div>

    <div class="sidebar-content">
      {#if activeTab === 'explorer'}
        <!-- Prototype Section: WORKSPACE (1 ARQUIVO) -->
        <div class="section-group">
          <div class="section-title">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="m6 9 6 6 6-6"/>
            </svg>
            <span>WORKSPACE (1 ARQUIVO)</span>
          </div>

          <div class="active-file-card">
            <span
              class="file-badge"
              style="color: {currentBadge.color}; background: {currentBadge.bg}; border-color: {currentBadge.border};"
            >
              {currentBadge.ext}
            </span>
            <span class="file-name">{currentProfile.entryFile}</span>
            <span class="file-dot" title="Arquivo ativo no editor">●</span>
          </div>

          <!-- Prototype Description Card -->
          <div class="workspace-info-card">
            <div class="card-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
              </svg>
              <strong>Workspace de arquivo único</strong>
            </div>
            <p class="card-desc">
              Um arquivo {currentProfile.label}, pronto para testar uma ideia sem configuração.
            </p>
          </div>
        </div>

        <!-- Language Selector Section (Preserves #select-language for tests and language switching) -->
        <div class="section-group">
          <div class="section-title">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="m6 9 6 6 6-6"/>
            </svg>
            <span>LINGUAGEM DO WORKSPACE</span>
          </div>
          <div class="lang-selector-container">
            <select
              id="select-language"
              class="lang-select"
              value={selectedLanguageId}
              onchange={(e) => onSelectLanguage((e.currentTarget as HTMLSelectElement).value)}
            >
              {#each languages as lang}
                <option value={lang.id}>{lang.label} ({lang.entryFile})</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Quick Presets Section in Explorer (Preserves .preset-btn for tests and fast loading) -->
        <div class="section-group">
          <div class="section-title">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
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
            <span>ISOLAMENTO & SEGURANÇA</span>
          </div>
          <div class="settings-box">
            <div class="setting-item">
              <span class="setting-key">Sandbox Isolado:</span>
              <span class="setting-val text-green">Web Worker</span>
            </div>
            <div class="setting-item">
              <span class="setting-key">Origem:</span>
              <span class="setting-val text-green">Separada (:8081)</span>
            </div>
            <div class="setting-item">
              <span class="setting-key">Timeout de Execução:</span>
              <span class="setting-val">3 s</span>
            </div>
            <div class="setting-item">
              <span class="setting-key">Quota de Output:</span>
              <span class="setting-val">256 KB</span>
            </div>
            <div class="setting-item">
              <span class="setting-key">DOM / localStorage:</span>
              <span class="setting-val text-green">Indisponíveis</span>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Draggable resizer -->
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
    background: #0f1217;
    border-right: 1px solid #1c2128;
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
    border-bottom: 1px solid #1c2128;
    background: #0f1217;
  }

  .sidebar-title {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #8b949e;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: #6e7681;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .icon-btn:hover {
    color: #e6edf3;
    background: #1c2128;
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 10px 0;
  }

  .section-group {
    margin-bottom: 18px;
  }

  .section-title {
    padding: 4px 12px;
    font-size: 0.68rem;
    font-weight: 700;
    color: #6e7681;
    display: flex;
    align-items: center;
    gap: 6px;
    letter-spacing: 0.06em;
  }

  /* Active File Card matching prototype */
  .active-file-card {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 6px 10px;
    padding: 7px 12px;
    background: #181d25;
    border: 1px solid #282f3c;
    border-radius: 6px;
    color: #e6edf3;
    cursor: default;
  }

  .file-badge {
    font-size: 0.68rem;
    font-weight: 800;
    padding: 2px 5px;
    border-radius: 4px;
    border: 1px solid;
    font-family: 'JetBrains Mono', Consolas, monospace;
    line-height: 1;
  }

  .file-name {
    flex: 1;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 0.82rem;
    font-weight: 500;
  }

  .file-dot {
    color: #e5a93c;
    font-size: 0.72rem;
  }

  /* Description Card matching prototype */
  .workspace-info-card {
    margin: 10px 10px;
    padding: 12px 14px;
    background: #12151c;
    border: 1px solid #232832;
    border-radius: 8px;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #c9d1d9;
    font-size: 0.78rem;
    margin-bottom: 6px;
  }

  .card-desc {
    margin: 0;
    color: #7d8590;
    font-size: 0.74rem;
    line-height: 1.45;
  }

  /* Language Selector */
  .lang-selector-container {
    padding: 4px 10px;
  }

  .lang-select {
    background: #161b22;
    color: #e6edf3;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 0.78rem;
    outline: none;
    cursor: pointer;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
  }

  .lang-select:focus {
    border-color: #e5a93c;
  }

  /* Presets List */
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
    background: #161b22;
    border: 1px solid #2d333b;
    border-radius: 6px;
    padding: 6px 10px;
    color: #c9d1d9;
    font-size: 0.76rem;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    width: 100%;
    box-sizing: border-box;
  }

  .preset-btn:hover {
    background: #21262d;
    color: #ffffff;
    border-color: #444c56;
  }

  .preset-icon {
    font-size: 0.75rem;
    color: #e5a93c;
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
    color: #8b949e;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
  }

  .settings-box {
    padding: 4px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    padding: 6px 0;
    border-bottom: 1px solid #1c2128;
  }

  .setting-key { color: #8b949e; }
  .setting-val { color: #e6edf3; font-family: monospace; font-size: 0.72rem; }
  .text-green { color: #3fb950; }

  /* Resizer */
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
    background: #e5a93c;
  }
</style>
