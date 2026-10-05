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
    <div class="status-item">
      <span class="dot-green">●</span>
      <span>Sandbox isolado</span>
    </div>

    <div class="status-item">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span>Worker descartável</span>
    </div>
  </div>

  <div class="status-right">
    <span class="status-item">{languageLabel}</span>
    <span class="status-item">UTF-8</span>
    <span class="status-item">LF</span>
  </div>
</footer>

<style>
  .status-bar-footer {
    height: 24px;
    background: #0d0f12;
    border-top: 1px solid #1c2128;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    font-size: 0.72rem;
    color: #8b949e;
    user-select: none;
    flex-shrink: 0;
    z-index: 10;
  }

  .status-left,
  .status-right {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 100%;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dot-green {
    color: #3fb950;
    font-size: 0.7rem;
    line-height: 1;
  }
</style>
