<script lang="ts">
  let {
    activeTab,
    isSidebarOpen,
    onTabClick,
    onOpenHelp
  }: {
    activeTab: 'explorer' | 'presets' | 'settings';
    isSidebarOpen: boolean;
    onTabClick: (tab: 'explorer' | 'presets' | 'settings') => void;
    onOpenHelp?: () => void;
  } = $props();
</script>

<aside class="activity-bar">
  <div class="top-group">
    <!-- Explorer Icon (Folder) -->
    <button
      type="button"
      class="activity-btn"
      class:active={isSidebarOpen && activeTab === 'explorer'}
      title="Explorador de Arquivos (Ctrl+B)"
      onclick={() => onTabClick('explorer')}
      aria-label="Explorador"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
      </svg>
    </button>

    <!-- Code Presets Icon ({ }) -->
    <button
      type="button"
      class="activity-btn"
      class:active={isSidebarOpen && activeTab === 'presets'}
      title="Exemplos e Snippets"
      onclick={() => onTabClick('presets')}
      aria-label="Exemplos"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/>
        <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>
      </svg>
    </button>

    <!-- Security & Sandbox Icon (Shield with Check) -->
    <button
      type="button"
      class="activity-btn"
      class:active={isSidebarOpen && activeTab === 'settings'}
      title="Segurança & Isolamento da Sandbox"
      onclick={() => onTabClick('settings')}
      aria-label="Segurança"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="m9 12 2 2 4-4"/>
      </svg>
    </button>
  </div>

  <div class="bottom-group">
    <!-- Help / Information Icon (?) -->
    <button
      type="button"
      class="activity-btn"
      title="Ajuda e Atalhos"
      onclick={() => onOpenHelp?.()}
      aria-label="Ajuda"
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    </button>
  </div>
</aside>

<style>
  .activity-bar {
    width: 48px;
    background: #0c0e12;
    border-right: 1px solid #1c2128;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    user-select: none;
    flex-shrink: 0;
    z-index: 10;
  }

  .top-group,
  .bottom-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .activity-btn {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #6e7681;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
    box-sizing: border-box;
  }

  .activity-btn:hover {
    color: #e6edf3;
    background: #161b22;
  }

  .activity-btn.active {
    color: #e5a93c;
    background: #161b22;
  }

  .activity-btn.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: #e5a93c;
    border-radius: 0 2px 2px 0;
  }
</style>
