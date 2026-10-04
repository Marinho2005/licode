import type {
  Runtime,
  RuntimeDescriptor,
  ExecutionSession
} from '@licode/runtime-core';
import type { ISandboxBridge } from './types.js';
import { RubyExecutionSession } from './session.js';

export class RubyRuntime implements Runtime {
  public readonly descriptor: RuntimeDescriptor = {
    id: 'ruby',
    languages: ['ruby'],
    build: 'none',
    exec: 'browser',
    capabilities: {
      stdin: 'none',
      interrupt: 'terminate-only'
    }
  };

  private sessionCounter = 0;

  constructor(private readonly bridge: ISandboxBridge) {}

  async install(onProgress: (p: number) => void): Promise<void> {
    const timeoutMs = 60000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const installPromise = (async () => {
        if (this.bridge.install) {
          await this.bridge.install('ruby', (loaded, total) => {
            const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 100;
            onProgress(pct);
          });
        } else {
          onProgress(100);
        }
      })();

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout de instalação do runtime Ruby excedido (${timeoutMs}ms).`));
        }, timeoutMs);
      });

      await Promise.race([installPromise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async warm(): Promise<void> {
    const timeoutMs = 60000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const warmPromise = this.bridge.ensureReady();
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout de warm-up do runtime Ruby excedido (${timeoutMs}ms).`));
        }, timeoutMs);
      });

      await Promise.race([warmPromise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async start(spec: {
    files: Record<string, string>;
    entry: string;
    limits: { wallMs: number; maxOutputBytes?: number };
  }): Promise<ExecutionSession> {
    await this.bridge.ensureReady();
    const sessionId = `ruby-exec-${Date.now()}-${++this.sessionCounter}`;
    const port = this.bridge.getPort();
    return new RubyExecutionSession(port, sessionId, spec);
  }

  async dispose(): Promise<void> {
    // no-op
  }
}
