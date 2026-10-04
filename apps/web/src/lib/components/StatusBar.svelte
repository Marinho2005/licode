<script lang="ts">
  import type { RuntimeState } from '@licode/runtime-core';

  let {
    languageLabel = 'JavaScript',
    runtimeState,
    execPhase,
    exitStatus,
    isSidebarOpen,
    onToggleSidebar
  }: {
    languageLabel?: string;
    runtimeState: RuntimeState | 'error';
    execPhase: 'idle' | 'compiling' | 'running';
    exitStatus: { code: number; reason?: string } | null;
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
  } = $props();
</script>

<footer class="status-bar-footer">
  <div class="status-left">
    <button
      type="button"
      class="status-item-btn sidebar-toggle-btn"
      title="Alternar Barra Lateral (Ctrl+B)"
      onclick={onToggleSidebar}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
      </svg>
      <span>{isSidebarOpen ? 'Fechar Barra' : 'Abrir Barra'}</span>
    </button>

    <div class="status-sep"></div>

    <span class="status-item sandbox-pill">
      <span class="state-dot state-{runtimeState}"></span>
      <span>Sandbox Isolado (:8081)</span>
    </span>

    {#if exitStatus}
      <div class="status-sep"></div>
      <span class="status-item exit-badge">
        Último exit: code {exitStatus.code} {exitStatus.reason ? `(${exitStatus.reason})` : ''}
      </span>
    {/if}
  </div>

  <div class="status-right">
    <span class="status-item">{languageLabel}</span>
    <div class="status-sep"></div>
    <span class="status-item">UTF-8</span>
    <div class="status-sep"></div>
    <span class="status-item">LF</span>
    <div class="status-sep"></div>
    <span class="status-item phase-status">
      {#if execPhase === 'running'}
        <span class="pulse-indicator">●</span> Executando
      {:else if execPhase === 'compiling'}
        <span class="spin-indicator">⟳</span> Compilando
      {:else}
        Pronto
      {/if}
    </span>
  </div>
</footer>

<style>
  .status-bar-footer {
    height: 24px;
    background: #09090b;
    border-top: 1px solid #27272a;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    font-size: 0.72rem;
    color: #a1a1aa;
    user-select: none;
    flex-shrink: 0;
    z-index: 10;
  }

  .status-left,
  .status-right {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 100%;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .status-item-btn {
    background: transparent;
    border: none;
    color: #a1a1aa;
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    padding: 0 4px;
    height: 100%;
    font-size: 0.72rem;
    transition: color 0.15s, background 0.15s;
  }

  .status-item-btn:hover {
    color: #f4f4f5;
    background: #27272a;
  }

  .status-sep {
    width: 1px;
    height: 12px;
    background: #3f3f46;
  }

  .state-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .state-ready { background: #10b981; }
  .state-installing, .state-warming { background: #f59e0b; }
  .state-not-installed { background: #71717a; }
  .state-error { background: #ef4444; }

  .exit-badge {
    color: #e4e4e7;
    font-family: monospace;
  }

  .pulse-indicator {
    color: #38bdf8;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .spin-indicator {
    display: inline-block;
    color: #f59e0b;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
