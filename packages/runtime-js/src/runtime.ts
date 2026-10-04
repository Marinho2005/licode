import type {
  Runtime,
  RuntimeDescriptor,
  ExecutionSession
} from '@licode/runtime-core';
import type { ISandboxBridge } from './types.js';
import { JSExecutionSession } from './session.js';

export class JavaScriptRuntime implements Runtime {
  public readonly descriptor: RuntimeDescriptor = {
    id: 'javascript',
    languages: ['javascript', 'js'],
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
    // JavaScript nativo do navegador já está pronto
    onProgress(100);
  }

  async warm(): Promise<void> {
    await this.bridge.ensureReady();
  }

  async start(spec: {
    files: Record<string, string>;
    entry: string;
    limits: { wallMs: number };
  }): Promise<ExecutionSession> {
    await this.bridge.ensureReady();
    const sessionId = `js-exec-${Date.now()}-${++this.sessionCounter}`;
    const port = this.bridge.getPort();
    return new JSExecutionSession(port, sessionId, spec);
  }

  async dispose(): Promise<void> {
    // Nada persistente a liberar no cliente
  }
}
