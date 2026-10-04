import type {
  ExecEvent,
  SandboxToHostMessage,
  WorkerInitMessage,
  WorkerToHostMessage,
  SignalType
} from '@licode/protocol';
import {
  DEFAULT_MAX_OUTPUT_BYTES,
  DEFAULT_WALL_LIMIT_MS,
  LOG_BATCH_INTERVAL_MS,
  PROTOCOL_VERSION
} from '@licode/protocol';

interface BufferItem {
  channel: 'stdout' | 'stderr';
  data: string;
}

export class SandboxSessionHost {
  private worker: Worker | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private outputBuffer: BufferItem[] = [];
  private totalOutputBytes = 0;
  private maxOutputBytes: number;
  private isTerminated = false;

  constructor(
    private readonly port: MessagePort,
    public readonly sessionId: string,
    private readonly spec: {
      files: Record<string, string>;
      entry: string;
      limits: { wallMs: number; maxOutputBytes?: number };
    }
  ) {
    this.maxOutputBytes = spec.limits.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    this.init();
  }

  private sendEvent(event: ExecEvent): void {
    if (this.isTerminated && event.t !== 'exit') {
      return;
    }
    const msg: SandboxToHostMessage = {
      id: this.sessionId,
      version: PROTOCOL_VERSION,
      type: 'event',
      event
    };
    this.port.postMessage(msg);
  }

  private init(): void {
    // 1. Emite fase compiling
    this.sendEvent({ t: 'phase', phase: 'compiling' });

    // 2. Instancia worker novo e descartável
    try {
      this.worker = new Worker(new URL('./worker/exec-worker.ts', import.meta.url), {
        type: 'module'
      });
    } catch (err: unknown) {
      this.sendEvent({
        t: 'stderr',
        data: `Failed to spawn Web Worker: ${err instanceof Error ? err.message : String(err)}\n`
      });
      this.sendEvent({ t: 'exit', code: 1, reason: 'error' });
      return;
    }

    // 3. Configura timer de timeout NA THREAD DO HOST
    const wallMs = this.spec.limits.wallMs || DEFAULT_WALL_LIMIT_MS;
    this.timeoutTimer = setTimeout(() => {
      this.handleTimeout();
    }, wallMs);

    // 4. Inicia loop de batch de logs
    this.scheduleBatchFlush();

    // 5. Escuta mensagens vindas do worker
    this.worker.addEventListener('message', (ev: MessageEvent<WorkerToHostMessage>) => {
      if (this.isTerminated) return;
      const msg = ev.data;

      if (msg.type === 'phase') {
        this.sendEvent({ t: 'phase', phase: msg.phase });
      } else if (msg.type === 'output') {
        this.queueOutput(msg.channel, msg.data);
      } else if (msg.type === 'exit') {
        this.flushBuffer();
        this.cleanup();
        this.sendEvent({
          t: 'exit',
          code: msg.code,
          reason: msg.code === 0 ? undefined : 'error'
        });
      }
    });

    this.worker.addEventListener('error', (ev: ErrorEvent) => {
      if (this.isTerminated) return;
      this.queueOutput('stderr', `Worker Error: ${ev.message}\n`);
      this.flushBuffer();
      this.cleanup();
      this.sendEvent({ t: 'exit', code: 1, reason: 'error' });
    });

    // 6. Envia payload de execução para o worker
    const initMsg: WorkerInitMessage = {
      id: this.sessionId,
      files: this.spec.files,
      entry: this.spec.entry
    };
    this.worker.postMessage(initMsg);
  }

  private queueOutput(channel: 'stdout' | 'stderr', data: string): void {
    if (this.isTerminated) return;

    const dataBytes = new Blob([data]).size;
    this.totalOutputBytes += dataBytes;

    this.outputBuffer.push({ channel, data });

    // Proteção contra output infinito
    if (this.totalOutputBytes > this.maxOutputBytes) {
      this.handleOutputLimit();
    }
  }

  private scheduleBatchFlush(): void {
    if (this.batchTimer || this.isTerminated) return;
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      this.flushBuffer();
      if (!this.isTerminated) {
        this.scheduleBatchFlush();
      }
    }, LOG_BATCH_INTERVAL_MS);
  }

  private flushBuffer(): void {
    if (this.outputBuffer.length === 0) return;

    const items = this.outputBuffer;
    this.outputBuffer = [];

    // Agrupa mensagens consecutivas do mesmo canal para reduzir postMessages
    let currentChannel: 'stdout' | 'stderr' | null = null;
    let accumulated = '';

    for (const item of items) {
      if (item.channel === currentChannel) {
        accumulated += item.data;
      } else {
        if (currentChannel !== null && accumulated.length > 0) {
          this.sendEvent({ t: currentChannel, data: accumulated });
        }
        currentChannel = item.channel;
        accumulated = item.data;
      }
    }

    if (currentChannel !== null && accumulated.length > 0) {
      this.sendEvent({ t: currentChannel, data: accumulated });
    }
  }

  private handleTimeout(): void {
    if (this.isTerminated) return;
    this.cleanupWorker();
    this.flushBuffer();
    this.sendEvent({
      t: 'stderr',
      data: `\n[Execution timed out after ${this.spec.limits.wallMs || DEFAULT_WALL_LIMIT_MS} ms]\n`
    });
    this.sendEvent({ t: 'exit', code: 124, reason: 'timeout' });
    this.cleanup();
  }

  private handleOutputLimit(): void {
    if (this.isTerminated) return;
    this.cleanupWorker();
    this.flushBuffer();
    this.sendEvent({
      t: 'stderr',
      data: `\n[Output limit exceeded (${this.maxOutputBytes} bytes). Process terminated.]\n`
    });
    this.sendEvent({ t: 'exit', code: 137, reason: 'output-limit' });
    this.cleanup();
  }

  public handleSignal(sig: SignalType): void {
    if (this.isTerminated) return;
    if (sig === 'SIGKILL' || sig === 'SIGINT') {
      this.cleanupWorker();
      this.flushBuffer();
      this.sendEvent({
        t: 'stderr',
        data: `\n[Process killed by user signal ${sig}]\n`
      });
      this.sendEvent({ t: 'exit', code: 137, reason: 'killed' });
      this.cleanup();
    }
  }

  public handleStdin(_data: string): void {
    // JavaScript browser runtime não suporta stdin interativo
  }

  private cleanupWorker(): void {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {}
      this.worker = null;
    }
  }

  public cleanup(): void {
    this.isTerminated = true;
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.cleanupWorker();
  }
}
