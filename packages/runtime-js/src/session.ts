import type {
  ExecEvent,
  HostToSandboxMessage,
  SandboxToHostMessage,
  SignalType
} from '@licode/protocol';
import type { Language } from '@licode/protocol';
import { PROTOCOL_VERSION } from '@licode/protocol';
import { AsyncQueue, type ExecutionSession } from '@licode/runtime-core';

export class JSExecutionSession implements ExecutionSession {
  public readonly events: AsyncQueue<ExecEvent>;
  public readonly done: Promise<{ code: number }>;
  private resolveDone!: (val: { code: number }) => void;
  private messageListener: (ev: MessageEvent<SandboxToHostMessage>) => void;

  constructor(
    private readonly port: MessagePort,
    private readonly sessionId: string,
    spec: { files: Record<string, string>; entry: string; limits: { wallMs: number }; language?: Language }
  ) {
    this.events = new AsyncQueue<ExecEvent>();
    this.done = new Promise<{ code: number }>((resolve) => {
      this.resolveDone = resolve;
    });

    this.messageListener = (event: MessageEvent<SandboxToHostMessage>) => {
      const msg = event.data;
      if (!msg || msg.id !== this.sessionId || msg.type !== 'event') {
        return;
      }

      const execEv = msg.event;
      this.events.push(execEv);

      if (execEv.t === 'exit') {
        this.cleanup();
        this.events.close();
        this.resolveDone({ code: execEv.code });
      }
    };

    this.port.addEventListener('message', this.messageListener);
    this.port.start();

    // Envia solicitação de execução com a versão do protocolo
    const execMsg: HostToSandboxMessage = {
      id: this.sessionId,
      version: PROTOCOL_VERSION,
      type: 'exec',
      language: spec.language ?? 'js',
      files: spec.files,
      entry: spec.entry,
      limits: {
        wallMs: spec.limits.wallMs
      }
    };
    this.port.postMessage(execMsg);
  }

  writeStdin(data: string): void {
    const msg: HostToSandboxMessage = {
      id: this.sessionId,
      version: PROTOCOL_VERSION,
      type: 'stdin',
      data
    };
    this.port.postMessage(msg);
  }

  async signal(sig: SignalType): Promise<void> {
    const msg: HostToSandboxMessage = {
      id: this.sessionId,
      version: PROTOCOL_VERSION,
      type: 'signal',
      sig
    };
    this.port.postMessage(msg);
  }

  private cleanup(): void {
    this.port.removeEventListener('message', this.messageListener);
  }
}
