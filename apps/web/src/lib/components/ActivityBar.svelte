<script lang="ts">
  let {
    activeTab,
    isSidebarOpen,
    onTabClick
  }: {
    activeTab: 'explorer' | 'presets' | 'settings';
    isSidebarOpen: boolean;
    onTabClick: (tab: 'explorer' | 'presets' | 'settings') => void;
  } = $props();
</script>

<aside class="activity-bar">
  <div class="top-group">
    <!-- Explorer Icon -->
    <button
      type="button"
      class="activity-btn"
      class:active={isSidebarOpen && activeTab === 'explorer'}
      title="Explorador de Arquivos (Ctrl+Shift+E)"
      onclick={() => onTabClick('explorer')}
      aria-label="Explorador"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
      </svg>
    </button>

    <!-- Presets / Quick Examples Icon -->
    <button
      type="button"
      class="activity-btn"
      class:active={isSidebarOpen && activeTab === 'presets'}
      title="Exemplos Rápidos e Snippets"
      onclick={() => onTabClick('presets')}
      aria-label="Exemplos Rápidos"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="m16 18 6-6-6-6"/>
        <path d="m8 6-6 6 6 6"/>
        <path d="m14 4-4 16"/>
      </svg>
    </button>

    <!-- Settings / Runtime Config Icon -->
    <button
      type="button"
      class="activity-btn"
      class:active={isSidebarOpen && activeTab === 'settings'}
      title="Configurações de Execução"
      onclick={() => onTabClick('settings')}
      aria-label="Configurações"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
  </div>

  <div class="bottom-group">
    <!-- Docs / Github link -->
    <a
      href="https://github.com/Marinho2005/licode"
      target="_blank"
      rel="noopener noreferrer"
      class="activity-btn"
      title="Código-fonte no GitHub"
      aria-label="GitHub"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
        <path d="M9 18c-4.51 2-5-2-7-2"/>
      </svg>
    </a>
  </div>
</aside>

<style>
  .activity-bar {
    width: 48px;
    background: #18181b;
    border-right: 1px solid #27272a;
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
    gap: 6px;
    width: 100%;
  }

  .activity-btn {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #71717a;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
    text-decoration: none;
    box-sizing: border-box;
  }

  .activity-btn:hover {
    color: #e4e4e7;
    background: #27272a;
  }

  .activity-btn.active {
    color: #38bdf8;
    background: #27272a;
  }

  .activity-btn.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 3px;
    background: #38bdf8;
    border-radius: 0 4px 4px 0;
  }
</style>
