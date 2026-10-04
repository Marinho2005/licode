<script lang="ts">
  let {
    presets,
    onSelect
  }: {
    presets: Record<string, { label: string; code: string }>;
    onSelect: (key: string) => void;
  } = $props();
</script>

<div class="presets-bar">
  <span class="presets-label">Exemplos Rápidos:</span>
  {#each Object.entries(presets) as [key, item]}
    <button class="preset-btn" onclick={() => onSelect(key)}>
      {item.label}
    </button>
  {/each}
</div>

<style>
  .presets-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    background: #0d1117;
    border-bottom: 1px solid #21262d;
    overflow-x: auto;
  }

  .presets-label {
    font-size: 0.8rem;
    color: #8b949e;
    font-weight: 600;
  }

  .preset-btn {
    background: #21262d;
    color: #c9d1d9;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 0.78rem;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }

  .preset-btn:hover {
    background: #30363d;
  }
</style>
