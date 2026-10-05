import type { WorkerInitMessage, WorkerToHostMessage } from '@licode/protocol';

// Intercepta self.fetch no worker para responder do CacheStorage licode-assets-v1 se disponível
const origFetch = self.fetch.bind(self);
self.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open('licode-assets-v1');
      const matched = await cache.match(input);
      if (matched) {
        return matched;
      }
    }
  } catch {}
  return origFetch(input, init);
};

let hasExited = false;

function emitExit(code: number, error?: string) {
  if (hasExited) return;
  hasExited = true;
  const msg: WorkerToHostMessage = {
    type: 'exit',
    code,
    error
  };
  self.postMessage(msg);
}

// Captura erros globais no Worker
self.addEventListener('error', (ev: ErrorEvent) => {
  const errMsg = ev.error ? String(ev.error) : (ev.message || 'Unknown runtime error');
  self.postMessage({
    type: 'output',
    channel: 'stderr',
    data: errMsg.endsWith('\n') ? errMsg : `${errMsg}\n`
  } satisfies WorkerToHostMessage);
  emitExit(1, errMsg);
});

self.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
  const reason = ev.reason ? (ev.reason instanceof Error ? ev.reason.message : String(ev.reason)) : 'Unhandled rejection';
  self.postMessage({
    type: 'output',
    channel: 'stderr',
    data: reason.endsWith('\n') ? reason : `${reason}\n`
  } satisfies WorkerToHostMessage);
  emitExit(1, reason);
});

self.addEventListener('message', async (ev: MessageEvent<WorkerInitMessage>) => {
  const { files, entry } = ev.data;

  // A inicialização do interpretador não consome o limite de execução do usuário.
  self.postMessage({ type: 'phase', phase: 'compiling' } satisfies WorkerToHostMessage);

  try {
    const origin = self.location.origin;
    const baseUrl = `${origin}/assets/pyodide/314.0.7/`;
    const pyodideModuleUrl = `${baseUrl}pyodide.mjs`;

    const { loadPyodide } = await import(/* @vite-ignore */ pyodideModuleUrl);
    const pyodide = await loadPyodide({
      indexURL: baseUrl,
      packages: []
    });

    pyodide.setStdout({
      batched: (output: string) => {
        self.postMessage({
          type: 'output',
          channel: 'stdout',
          data: output.endsWith('\n') ? output : `${output}\n`
        } satisfies WorkerToHostMessage);
      }
    });

    pyodide.setStderr({
      batched: (output: string) => {
        self.postMessage({
          type: 'output',
          channel: 'stderr',
          data: output.endsWith('\n') ? output : `${output}\n`
        } satisfies WorkerToHostMessage);
      }
    });

    pyodide.setStdin({
      isatty: false,
      error: false,
      stdin: () => null
    });

    self.postMessage({ type: 'phase', phase: 'running' } satisfies WorkerToHostMessage);

    for (const [filename, content] of Object.entries(files)) {
      try {
        pyodide.FS.writeFile(filename, content);
      } catch {}
    }

    const code = files[entry] || '';
    await pyodide.runPythonAsync(code);
    emitExit(0);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    self.postMessage({
      type: 'output',
      channel: 'stderr',
      data: errMsg.endsWith('\n') ? errMsg : `${errMsg}\n`
    } satisfies WorkerToHostMessage);
    emitExit(1, errMsg);
  }
});
