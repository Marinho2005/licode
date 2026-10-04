export type ExecPhase = 'compiling' | 'running';

export type ExitReason = 'timeout' | 'killed' | 'error' | 'output-limit';

export type ExecEvent =
  | { t: 'phase'; phase: ExecPhase }
  | { t: 'stdout' | 'stderr'; data: string }
  | { t: 'exit'; code: number; reason?: ExitReason };

export type SignalType = 'SIGINT' | 'SIGKILL';

// Handshake inicial via window.postMessage entre UI e iframe do Sandbox
export interface HandshakeInitMessage {
  type: 'licode:handshake-init';
  version: string;
}

export interface HandshakeAckMessage {
  type: 'licode:handshake-ack';
  version: string;
}

// Mensagens enviadas pela UI para o Sandbox através do MessagePort
export type HostToSandboxMessage =
  | {
      id: string;
      version: string;
      type: 'exec';
      files: Record<string, string>;
      entry: string;
      limits: {
        wallMs: number;
        maxOutputBytes?: number;
      };
    }
  | {
      id: string;
      version: string;
      type: 'stdin';
      data: string;
    }
  | {
      id: string;
      version: string;
      type: 'signal';
      sig: SignalType;
    };

// Mensagens enviadas pelo Sandbox para a UI através do MessagePort
export type SandboxToHostMessage =
  | {
      id: string;
      version: string;
      type: 'event';
      event: ExecEvent;
    };

// Mensagens internas entre o Sandbox Host e o Web Worker descartável
export type WorkerInitMessage = {
  id: string;
  files: Record<string, string>;
  entry: string;
};

export type WorkerToHostMessage =
  | { type: 'phase'; phase: ExecPhase }
  | { type: 'output'; channel: 'stdout' | 'stderr'; data: string }
  | { type: 'exit'; code: number; error?: string };
