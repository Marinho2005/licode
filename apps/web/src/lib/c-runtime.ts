import type { ExecEvent, WorkerToHostMessage } from '@licode/protocol';
import { AsyncQueue, type ExecutionSession, type Runtime, type RuntimeDescriptor } from '@licode/runtime-core';

class CExecutionSession implements ExecutionSession {
  readonly events = new AsyncQueue<ExecEvent>();
  readonly done: Promise<{ code: number }>;
  private readonly worker = new Worker(new URL('./worker/c-worker.ts', import.meta.url), { type: 'module' });
  private timer: ReturnType<typeof setTimeout> | null = null;
  private resolveDone!: (result: { code: number }) => void;
  private finished = false;

  constructor(spec: { files: Record<string, string>; entry: string; limits: { wallMs: number } }) {
    this.done = new Promise((resolve) => (this.resolveDone = resolve));
    this.armTimeout(120_000);
    this.worker.addEventListener('message', (event: MessageEvent<WorkerToHostMessage>) => {
      if (this.finished) return;
      const message = event.data;
      if (message.type === 'phase') {
        if (message.phase === 'running') this.armTimeout(spec.limits.wallMs);
        this.events.push({ t: 'phase', phase: message.phase });
      } else if (message.type === 'output') {
        this.events.push({ t: message.channel, data: message.data });
      } else if (message.type === 'exit') {
        this.finish(message.code, message.code === 0 ? undefined : 'error', false);
      }
    });
    this.worker.addEventListener('error', (event: ErrorEvent) => {
      this.events.push({ t: 'stderr', data: `${event.message}\n` });
      this.finish(1, 'error');
    });
    this.worker.postMessage({ id: `c-${Date.now()}`, language: 'c', files: spec.files, entry: spec.entry });
  }

  writeStdin(_data: string): void {}

  async signal(_sig: 'SIGINT' | 'SIGKILL'): Promise<void> {
    if (this.finished) return;
    this.events.push({ t: 'stderr', data: '\n[Process killed by user signal SIGKILL]\n' });
    this.finish(137, 'killed');
  }

  private armTimeout(durationMs: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.finished) return;
      this.events.push({ t: 'stderr', data: `\n[C compilation or execution timed out after ${durationMs} ms]\n` });
      this.finish(124, 'timeout');
    }, Math.max(1, durationMs));
  }

  private finish(code: number, reason?: 'timeout' | 'killed' | 'error', terminateWorker = true): void {
    if (this.finished) return;
    this.finished = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (terminateWorker) this.worker.terminate();
    this.events.push({ t: 'exit', code, reason });
    this.events.close();
    this.resolveDone({ code });
  }
}

export class CRuntime implements Runtime {
  readonly descriptor: RuntimeDescriptor = {
    id: 'c', languages: ['c'], build: 'browser', exec: 'browser',
    capabilities: { stdin: 'none', interrupt: 'terminate-only' }
  };

  async install(onProgress: (progress: number) => void): Promise<void> { onProgress(100); }
  async warm(): Promise<void> {}
  async start(spec: { files: Record<string, string>; entry: string; limits: { wallMs: number } }): Promise<ExecutionSession> {
    return new CExecutionSession(spec);
  }
  async dispose(): Promise<void> {}
}
