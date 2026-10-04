import type { ExecEvent } from '@licode/protocol';

export { ExecEvent };

export interface ExecutionSession {
  events: AsyncIterable<ExecEvent>;
  writeStdin(data: string): void;
  signal(sig: 'SIGINT' | 'SIGKILL'): Promise<void>;
  done: Promise<{ code: number }>;
}

export interface RuntimeDescriptor {
  id: string;
  languages: string[];
  build: 'browser' | 'cloud' | 'none';
  exec: 'browser' | 'cloud';
  capabilities: {
    stdin: 'interactive' | 'batch' | 'none';
    interrupt: 'cooperative' | 'terminate-only';
  };
}

export interface Runtime {
  descriptor: RuntimeDescriptor;
  install(onProgress: (p: number) => void): Promise<void>;  // baixar/cachear
  warm(): Promise<void>;                                    // instanciar
  start(spec: {
    files: Record<string, string>;
    entry: string;
    limits: { wallMs: number };
  }): Promise<ExecutionSession>;
  dispose(): Promise<void>;
}

export type RuntimeState = 'not-installed' | 'installing' | 'installed' | 'warming' | 'ready';
