<script lang="ts">
  import type { RuntimeState } from '@licode/runtime-core';

  let {
    runtimeState,
    execPhase,
    exitStatus,
    runtimeLabel = 'Runtime JS',
    isRunDisabled = false,
    isStopDisabled = true,
    onRun,
    onStop
  }: {
    runtimeState: RuntimeState | 'error';
    execPhase: 'idle' | 'compiling' | 'running';
    exitStatus: { code: number; reason?: string } | null;
    runtimeLabel?: string;
    isRunDisabled?: boolean;
    isStopDisabled?: boolean;
    onRun?: () => void;
    onStop?: () => void;
  } = $props();

  const stateText = $derived(
    runtimeState === 'ready'
      ? 'PRONTO'
      : runtimeState === 'installing'
      ? 'INSTALANDO'
      : runtimeState === 'warming'
      ? 'PREPARANDO'
      : runtimeState === 'error'
      ? 'ERRO'
      : runtimeState.toUpperCase()
  );
</script>

<header class="header">
  <!-- Brand / Logo Area -->
  <div class="logo-area">
    <div class="logo-box">
      <span class="logo-letter">L</span>
    </div>
    <div class="logo-text-group">
      <span class="logo-title">LiCode<span class="logo-domain">.dev</span></span>
      <span class="logo-sep">|</span>
      <span class="logo-subtitle">IDE no navegador</span>
    </div>
  </div>

  <!-- Center: Action Controls (Run & Stop buttons) -->
  <div class="action-controls">
    <button
      type="button"
      class="btn btn-run"
      disabled={isRunDisabled}
      onclick={onRun}
      title="Executar código (⌘↵ / Ctrl+Enter)"
    >
      {#if execPhase === 'compiling' || execPhase === 'running'}
        <span class="btn-spinner"></span>
        <span>Executando...</span>
      {:else}
        <svg class="run-icon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="6 3 20 12 6 21 6 3" />
        </svg>
        <span class="btn-label">Run</span>
        <span class="shortcut-tag">⌘↵</span>
      {/if}
    </button>

    <button
      type="button"
      class="btn btn-stop"
      disabled={isStopDisabled}
      onclick={onStop}
      title="Interromper execução (SIGKILL)"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="2" />
      </svg>
      <span>Stop</span>
    </button>

    {#if exitStatus}
      <span class="status-badge reason-{exitStatus.reason || 'success'}">
        Terminado: code {exitStatus.code} {exitStatus.reason ? `(${exitStatus.reason})` : ''}
      </span>
    {/if}
  </div>

  <!-- Right: Status Bar Area (Preserves test assertions for .status-bar and .state-ready) -->
  <div class="status-bar">
    <span class="status-item runtime-indicator">
      <span class="runtime-name">{runtimeLabel}:</span>
      <strong class="runtime-val state-{runtimeState}">{stateText}</strong>
    </span>

    <span class="status-item sandbox-indicator">
      <span class="dot-green">●</span>
      <span class="sandbox-name">Sandbox pronto</span>
    </span>
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 48px;
    padding: 0 16px;
    background: #0f1217;
    border-bottom: 1px solid #1c2128;
    user-select: none;
    flex-shrink: 0;
    gap: 16px;
    box-sizing: border-box;
  }

  .logo-area {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-box {
    width: 26px;
    height: 26px;
    background: #1c1811;
    border: 1px solid #b47818;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  .logo-letter {
    color: #e5a93c;
    font-weight: 800;
    font-size: 15px;
    line-height: 1;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  }

  .logo-text-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo-title {
    font-size: 0.98rem;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
  }

  .logo-domain {
    color: #8b949e;
    font-weight: 400;
  }

  .logo-sep {
    color: #30363d;
    font-size: 0.8rem;
    font-weight: 300;
  }

  .logo-subtitle {
    font-size: 0.82rem;
    color: #8b949e;
    font-weight: 400;
  }

  .action-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 6px;
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .btn-run {
    background: #e5a93c;
    color: #0d0f12;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .btn-run:hover:not(:disabled) {
    background: #f0b54e;
  }

  .run-icon {
    flex-shrink: 0;
  }

  .btn-label {
    font-weight: 700;
  }

  .shortcut-tag {
    font-size: 0.72rem;
    font-weight: 600;
    color: #382c16;
    background: rgba(0, 0, 0, 0.12);
    padding: 1px 5px;
    border-radius: 4px;
    margin-left: 2px;
  }

  .btn-stop {
    background: #1c2128;
    color: #8b949e;
    border: 1px solid #30363d;
  }

  .btn-stop:hover:not(:disabled) {
    background: #252b36;
    color: #f85149;
    border-color: #f8514944;
  }

  .btn-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(0, 0, 0, 0.3);
    border-top-color: #0d0f12;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .status-badge {
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.74rem;
    font-family: 'JetBrains Mono', Consolas, monospace;
  }

  .reason-success { background: #1f6feb22; color: #58a6ff; border: 1px solid #1f6feb55; }
  .reason-timeout { background: #d2992222; color: #e3b341; border: 1px solid #d2992255; }
  .reason-killed { background: #f8514922; color: #ff7b72; border: 1px solid #f8514955; }
  .reason-output-limit { background: #bc8cff22; color: #d2a8ff; border: 1px solid #bc8cff55; }
  .reason-error { background: #f8514922; color: #ff7b72; border: 1px solid #f8514955; }

  /* Test selector: .status-bar and .state-ready */
  .status-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 0.8rem;
    color: #8b949e;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .runtime-name {
    color: #8b949e;
    font-size: 0.78rem;
  }

  .runtime-val {
    font-size: 0.78rem;
    font-weight: 700;
  }

  .state-ready { color: #3fb950; }
  .state-installing, .state-warming { color: #d29922; }
  .state-not-installed { color: #6e7681; }
  .state-error { color: #f85149; }

  .dot-green {
    color: #3fb950;
    font-size: 0.75rem;
    line-height: 1;
  }

  .sandbox-name {
    color: #8b949e;
    font-size: 0.78rem;
  }
</style>
