import type {
  HandshakeAckMessage,
  HandshakeInitMessage,
  HostToSandboxMessage
} from '@licode/protocol';
import { PROTOCOL_VERSION } from '@licode/protocol';
import { SandboxSessionHost } from './session-host.js';

let activeSession: SandboxSessionHost | null = null;
let boundPort: MessagePort | null = null;

function setupPort(port: MessagePort) {
  boundPort = port;

  port.addEventListener('message', (ev: MessageEvent<HostToSandboxMessage>) => {
    const msg = ev.data;
    if (!msg) return;

    if (msg.type === 'exec') {
      if (activeSession) {
        activeSession.cleanup();
      }
      activeSession = new SandboxSessionHost(port, msg.id, {
        files: msg.files,
        entry: msg.entry,
        limits: msg.limits
      });
    } else if (msg.type === 'signal') {
      if (activeSession && activeSession.sessionId === msg.id) {
        activeSession.handleSignal(msg.sig);
      }
    } else if (msg.type === 'stdin') {
      if (activeSession && activeSession.sessionId === msg.id) {
        activeSession.handleStdin(msg.data);
      }
    }
  });

  port.start();

  const ackMsg: HandshakeAckMessage = {
    type: 'licode:handshake-ack',
    version: PROTOCOL_VERSION
  };
  port.postMessage(ackMsg);
  console.log('[LiCode Sandbox] Handshake estabelecido com sucesso via MessagePort!');
}

window.addEventListener('message', (ev: MessageEvent) => {
  const data = ev.data;
  console.log('[LiCode Sandbox] Recebeu window message:', data);
  if (!data || data.type !== 'licode:handshake-init') {
    return;
  }

  if (ev.ports && ev.ports[0]) {
    console.log('[LiCode Sandbox] MessagePort recebida, configurando...');
    setupPort(ev.ports[0]);
  }
});

// Anuncia ao pai que o sandbox está carregado
function pingReady() {
  if (boundPort) return;
  console.log('[LiCode Sandbox] Emitindo licode:sandbox-ready para parent...');
  try {
    window.parent.postMessage({ type: 'licode:sandbox-ready', version: PROTOCOL_VERSION }, '*');
  } catch (err) {
    console.error('[LiCode Sandbox] Erro ao postar para parent:', err);
  }
}

pingReady();
const readyInterval = setInterval(() => {
  if (boundPort) {
    clearInterval(readyInterval);
  } else {
    pingReady();
  }
}, 300);

console.log('[LiCode Sandbox] Inicializado e pronto para handshake.');
