import type {
  HandshakeAckMessage,
  HandshakeInitMessage,
  HostToSandboxMessage,
  Language,
  SandboxToHostMessage
} from '@licode/protocol';
import { PROTOCOL_VERSION } from '@licode/protocol';
import type { ISandboxBridge } from '@licode/runtime-js';

export interface SandboxBridgeOptions {
  sandboxOrigin?: string;
}

export class SandboxBridge implements ISandboxBridge {
  private iframe: HTMLIFrameElement | null = null;
  private port: MessagePort | null = null;
  private readyPromise: Promise<void> | null = null;
  private sandboxOrigin: string;

  constructor(options: SandboxBridgeOptions = {}) {
    this.sandboxOrigin = options.sandboxOrigin || 'http://localhost:5174';
  }

  public attachIframe(iframeEl: HTMLIFrameElement): void {
    this.iframe = iframeEl;
  }

  public async ensureReady(): Promise<void> {
    if (this.port) return;
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise<void>((resolve, reject) => {
      if (!this.iframe) {
        return reject(new Error('Elemento <iframe> do sandbox não está anexado.'));
      }

      let isResolved = false;
      let pingInterval: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        isResolved = true;
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        window.removeEventListener('message', onWindowMessage);
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `Timeout aguardando handshake do sandbox (${this.sandboxOrigin}). Certifique-se de que apps/sandbox está rodando.`
          )
        );
      }, 10000);

      const sendNewPort = () => {
        if (isResolved || !this.iframe || !this.iframe.contentWindow) return;

        const channel = new MessageChannel();
        const testPort = channel.port1;

        testPort.addEventListener('message', (ev: MessageEvent<HandshakeAckMessage>) => {
          const msg = ev.data;
          console.log('[LiCode Web Host] Recebeu mensagem na port:', msg);
          if (msg && msg.type === 'licode:handshake-ack') {
            clearTimeout(timeoutId);
            cleanup();
            this.port = testPort;
            console.log('[LiCode Web Host] Conexão com Sandbox confirmada com sucesso!');
            resolve();
          }
        });
        testPort.start();

        try {
          console.log('[LiCode Web Host] Enviando licode:handshake-init com port2 para o sandbox...');
          const initMsg: HandshakeInitMessage = {
            type: 'licode:handshake-init',
            version: PROTOCOL_VERSION
          };
          this.iframe.contentWindow.postMessage(initMsg, '*', [channel.port2]);
        } catch (err) {
          console.error('[LiCode Web Host] Erro ao enviar postMessage com port2:', err);
        }
      };

      const onWindowMessage = (ev: MessageEvent) => {
        if (isResolved) return;
        console.log('[LiCode Web Host] Recebeu window message do parent/iframe:', ev.data);
        if (ev.data && ev.data.type === 'licode:sandbox-ready') {
          sendNewPort();
        }
      };
      window.addEventListener('message', onWindowMessage);

      this.iframe.addEventListener('load', () => {
        console.log('[LiCode Web Host] Iframe evento "load" disparado.');
        sendNewPort();
      });

      // Tenta imediatamente e faz retry a cada 400ms se ainda não resolveu
      sendNewPort();
      pingInterval = setInterval(() => {
        if (!isResolved) {
          sendNewPort();
        }
      }, 400);
    });

    return this.readyPromise;
  }

  public getPort(): MessagePort {
    if (!this.port) {
      throw new Error('Sandbox bridge não está pronta. Chame ensureReady() primeiro.');
    }
    return this.port;
  }

  public async install(
    language: Language,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<{ totalBytes: number; cached: boolean }> {
    await this.ensureReady();
    const port = this.getPort();
    const id = `install-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    return new Promise<{ totalBytes: number; cached: boolean }>((resolve, reject) => {
      const onMessage = (ev: MessageEvent<SandboxToHostMessage>) => {
        const msg = ev.data;
        if (!msg || msg.id !== id) return;

        if (msg.type === 'install-progress') {
          onProgress?.(msg.loaded, msg.total);
        } else if (msg.type === 'install-done') {
          cleanup();
          resolve({ totalBytes: msg.totalBytes, cached: msg.cached });
        } else if (msg.type === 'install-error') {
          cleanup();
          reject(new Error(msg.message));
        }
      };

      const cleanup = () => {
        port.removeEventListener('message', onMessage);
      };

      port.addEventListener('message', onMessage);

      const installMsg: HostToSandboxMessage = {
        id,
        version: PROTOCOL_VERSION,
        type: 'install',
        language
      };
      port.postMessage(installMsg);
    });
  }
}

