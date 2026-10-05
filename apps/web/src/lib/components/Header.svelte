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
</script>

<header class="header">
  <!-- Brand / Logo Area -->
  <div class="logo-area">
    <div class="logo-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    </div>
    <div class="logo-text-group">
      <span class="logo-title">LiCode<span class="dot">.dev</span></span>
      <span class="badge">In-Browser IDE</span>
    </div>
  </div>

  <!-- Center: Action Controls (Replit Style) -->
  <div class="action-controls">
    <button
      type="button"
      class="btn btn-run"
      disabled={isRunDisabled}
      onclick={onRun}
      title="Executar código (Ctrl+Enter)"
    >
      {#if execPhase === 'compiling' || execPhase === 'running'}
        <span class="btn-spinner"></span>
        <span>Executando...</span>
      {:else}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        <span>Run</span>
      {/if}
    </button>

    <button
      type="button"
      class="btn btn-stop"
      disabled={isStopDisabled}
      onclick={onStop}
      title="Interromper execução (SIGKILL)"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
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

  <!-- Right: Status Bar Area (Required by E2E tests: .status-bar and .state-ready) -->
  <div class="status-bar">
    <span class="status-item">
      {runtimeLabel}: <strong class="state-{runtimeState}">{runtimeState}</strong>
    </span>
    <span class="status-item">
      Fase: <strong class="phase-{execPhase}">{execPhase}</strong>
    </span>
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 44px;
    padding: 0 16px;
    background: #18181b;
    border-bottom: 1px solid #27272a;
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

  .logo-icon {
    width: 26px;
    height: 26px;
    background: linear-gradient(135deg, #0284c7, #38bdf8);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
  }

  .logo-text-group {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .logo-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #f4f4f5;
    letter-spacing: -0.02em;
  }

  .dot {
    color: #10b981;
  }

  .badge {
    font-size: 0.68rem;
    padding: 1px 6px;
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 10px;
    color: #a1a1aa;
    font-weight: 500;
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
    padding: 5px 14px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-run {
    background: #10b981;
    color: #ffffff;
    box-shadow: 0 1px 3px rgba(16, 185, 129, 0.2);
  }

  .btn-run:hover:not(:disabled) {
    background: #059669;
  }

  .btn-stop {
    background: #ef4444;
    color: #ffffff;
  }

  .btn-stop:hover:not(:disabled) {
    background: #dc2626;
  }

  .btn-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid #ffffff44;
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .status-badge {
    padding: 3px 10px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.78rem;
    font-family: 'Fira Code', Consolas, monospace;
  }

  .reason-success { background: #0284c722; color: #38bdf8; border: 1px solid #0284c7; }
  .reason-timeout { background: #f59e0b22; color: #fbbf24; border: 1px solid #f59e0b; }
  .reason-killed { background: #ef444422; color: #f87171; border: 1px solid #ef4444; }
  .reason-output-limit { background: #d946ef22; color: #f472b6; border: 1px solid #d946ef; }
  .reason-error { background: #ef444422; color: #f87171; border: 1px solid #ef4444; }

  /* E2E Selector preservation */
  .status-bar {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 0.8rem;
    color: #a1a1aa;
  }

  .status-item strong {
    text-transform: uppercase;
    font-size: 0.75rem;
  }

  .state-ready { color: #10b981; }
  .state-installing, .state-warming { color: #f59e0b; }
  .state-not-installed { color: #71717a; }
  .state-error { color: #ef4444; }

  .phase-running { color: #38bdf8; }
  .phase-compiling { color: #f59e0b; }
  .phase-idle { color: #71717a; }
</style>
