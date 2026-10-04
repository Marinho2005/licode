import type {
  HandshakeAckMessage,
  HandshakeInitMessage,
  HostToSandboxMessage,
  SandboxToHostMessage
} from '@licode/protocol';
import { PROTOCOL_VERSION } from '@licode/protocol';
import { SandboxSessionHost } from './session-host.js';
import { installAssets } from './asset-installer.js';

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
        language: msg.language,
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
    } else if (msg.type === 'install') {
      installAssets(msg.language, (loaded, total) => {
        const progressMsg: SandboxToHostMessage = {
          id: msg.id,
          version: PROTOCOL_VERSION,
          type: 'install-progress',
          loaded,
          total
        };
        port.postMessage(progressMsg);
      })
        .then(({ totalBytes, cached }) => {
          const doneMsg: SandboxToHostMessage = {
            id: msg.id,
            version: PROTOCOL_VERSION,
            type: 'install-done',
            totalBytes,
            cached
          };
          port.postMessage(doneMsg);
        })
        .catch((err: unknown) => {
          const errorMsg: SandboxToHostMessage = {
            id: msg.id,
            version: PROTOCOL_VERSION,
            type: 'install-error',
            message: err instanceof Error ? err.message : String(err)
          };
          port.postMessage(errorMsg);
        });
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

const env = (import.meta as unknown as { env?: Record<string, any> }).env;
const envAllowed = env?.VITE_ALLOWED_PARENT_ORIGINS;
const isDev = Boolean(env?.DEV);

// Em produção sem VITE_ALLOWED_PARENT_ORIGINS: a lista deve ser vazia (falha fechada).
// Defaults (localhost:5173, :8080) são permitidos apenas em dev.
const allowedParentOrigins: string[] = envAllowed
  ? String(envAllowed)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : isDev
    ? ['http://localhost:5173', 'http://localhost:8080']
    : [];

if (allowedParentOrigins.length === 0) {
  console.error(
    '[LiCode Sandbox Security] Nenhuma origem de host permitida configurada (falha fechada). O sandbox rejeitará todas as tentativas de handshake.'
  );
}

window.addEventListener('message', (ev: MessageEvent) => {
  const data = ev.data;
  console.log('[LiCode Sandbox] Recebeu window message:', data);
  if (!data || data.type !== 'licode:handshake-init') {
    return;
  }

  // 1) Ordem estrita: validar event.origin na lista de permitidos
  if (!allowedParentOrigins.includes(ev.origin)) {
    console.warn(
      `[LiCode Sandbox Security] Handshake rejeitado: origin="${ev.origin}" não permitida. Origens permitidas: [${allowedParentOrigins.join(', ')}]`
    );
    return;
  }

  // 2) Ordem estrita: validar event.source === window.parent
  if (ev.source !== window.parent) {
    console.warn(
      `[LiCode Sandbox Security] Handshake rejeitado: origin correta, mas source não é window.parent (sourceMatch=${ev.source === window.parent}).`
    );
    return;
  }

  // O handshake deve ser aceito apenas UMA vez; tentativas seguintes devem ser ignoradas com log
  if (boundPort) {
    console.warn('[LiCode Sandbox Security] Handshake ignorado: já existe um handshake ativo previamente estabelecido.');
    return;
  }

  // 3) SÓ ENTÃO usar event.ports[0] ou criar Worker
  if (!ev.ports || !ev.ports[0]) {
    console.warn('[LiCode Sandbox Security] Handshake rejeitado: nenhuma MessagePort fornecida em event.ports[0].');
    return;
  }

  console.log('[LiCode Sandbox] MessagePort recebida, configurando...');
  setupPort(ev.ports[0]);
});

// Anuncia ao pai que o sandbox está carregado
function pingReady() {
  if (boundPort || allowedParentOrigins.length === 0) return;
  console.log('[LiCode Sandbox] Emitindo licode:sandbox-ready para parent...');
  for (const origin of allowedParentOrigins) {
    try {
      window.parent.postMessage({ type: 'licode:sandbox-ready', version: PROTOCOL_VERSION }, origin);
    } catch (err) {
      console.error(`[LiCode Sandbox] Erro ao postar para parent origin ${origin}:`, err);
    }
  }
}

pingReady();
const readyInterval = setInterval(() => {
  if (boundPort || allowedParentOrigins.length === 0) {
    clearInterval(readyInterval);
  } else {
    pingReady();
  }
}, 300);

console.log('[LiCode Sandbox] Inicializado e pronto para handshake.');
