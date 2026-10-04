import type { Language } from '@licode/protocol';

export interface ISandboxBridge {
  ensureReady(): Promise<void>;
  getPort(): MessagePort;
  install?(
    language: Language,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<{ totalBytes: number; cached: boolean }>;
}
