<script lang="ts">
  import type { RuntimeState } from '@licode/runtime-core';

  let {
    runtimeState,
    execPhase,
    exitStatus
  }: {
    runtimeState: RuntimeState | 'error';
    execPhase: 'idle' | 'compiling' | 'running';
    exitStatus: { code: number; reason?: string } | null;
  } = $props();
</script>

<header class="header">
  <div class="logo-area">
    <span class="logo-title">LiCode<span class="dot">.dev</span></span>
    <span class="badge">In-Browser Isolation IDE</span>
  </div>
  <div class="status-bar">
    <span class="status-item">
      Runtime JS: <strong class="state-{runtimeState}">{runtimeState}</strong>
    </span>
    <span class="status-item">
      Fase: <strong class="phase-{execPhase}">{execPhase}</strong>
    </span>
    {#if exitStatus}
      <span class="status-badge reason-{exitStatus.reason || 'success'}">
        Terminado: code {exitStatus.code} {exitStatus.reason ? `(${exitStatus.reason})` : ''}
      </span>
    {/if}
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 18px;
    background: #161b22;
    border-bottom: 1px solid #30363d;
  }

  .logo-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #58a6ff;
  }

  .dot {
    color: #2ea043;
  }

  .badge {
    margin-left: 10px;
    font-size: 0.75rem;
    padding: 2px 8px;
    background: #21262d;
    border: 1px solid #30363d;
    border-radius: 12px;
    color: #8b949e;
  }

  .status-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 0.85rem;
  }

  .status-item strong {
    text-transform: uppercase;
    font-size: 0.78rem;
  }

  .state-ready { color: #3fb950; }
  .state-installing, .state-warming { color: #d29922; }
  .state-not-installed { color: #8b949e; }
  .state-error { color: #f85149; }

  .phase-running { color: #58a6ff; }
  .phase-compiling { color: #d29922; }
  .phase-idle { color: #8b949e; }

  .status-badge {
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.8rem;
  }

  .reason-success { background: #1f6feb33; color: #58a6ff; border: 1px solid #1f6feb; }
  .reason-timeout { background: #d2992233; color: #f2cc60; border: 1px solid #d29922; }
  .reason-killed { background: #f8514933; color: #ff7b72; border: 1px solid #f85149; }
  .reason-output-limit { background: #db61a233; color: #f778ba; border: 1px solid #db61a2; }
  .reason-error { background: #f8514933; color: #ff7b72; border: 1px solid #f85149; }
</style>
