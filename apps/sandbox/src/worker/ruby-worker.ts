import type { WorkerInitMessage, WorkerToHostMessage } from '@licode/protocol';
import { RubyVM, consolePrinter } from '@ruby/wasm-wasi';
import { File as WasiFile, OpenFile, PreopenDirectory, WASI } from '@bjorn3/browser_wasi_shim';

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

  self.postMessage({ type: 'phase', phase: 'running' } satisfies WorkerToHostMessage);

  try {
    const origin = self.location.origin;
    const rubyWasmUrl = `${origin}/assets/ruby/2.10.1/ruby+stdlib.wasm`;

    const response = await fetch(rubyWasmUrl);
    if (!response.ok) {
      throw new Error(`Failed to load ruby.wasm: ${response.statusText}`);
    }
    const wasmModule = await WebAssembly.compileStreaming(response);

    const fds = [
      new OpenFile(new WasiFile([])), // stdin
      new OpenFile(new WasiFile([])), // stdout
      new OpenFile(new WasiFile([])), // stderr
      new PreopenDirectory("/", new Map()),
    ];

    // Popula fs virtual inicial com os arquivos enviados via mensagem
    const wasiDir = fds[3] as PreopenDirectory;
    for (const [filename, content] of Object.entries(files)) {
      wasiDir.dir.contents.set(filename, new WasiFile(new TextEncoder().encode(content)));
    }

    const wasi = new WASI([], [], fds, { debug: false });
    
    // Captura stdout e stderr
    const printer = consolePrinter({
      stdout: (output: string) => {
        self.postMessage({
          type: 'output',
          channel: 'stdout',
          data: output
        } satisfies WorkerToHostMessage);
      },
      stderr: (output: string) => {
        self.postMessage({
          type: 'output',
          channel: 'stderr',
          data: output
        } satisfies WorkerToHostMessage);
      }
    });

    const { vm } = await RubyVM.instantiateModule({
      module: wasmModule,
      wasip1: wasi,
      addToImports: (imports: WebAssembly.Imports) => printer.addToImports(imports),
      setMemory: (memory: WebAssembly.Memory) => printer.setMemory(memory)
    });

    const code = files[entry] || '';
    
    try {
      const wrappedCode = `
begin
  eval ${JSON.stringify(code)}, TOPLEVEL_BINDING, ${JSON.stringify(entry)}
  0
rescue SystemExit => e
  e.status
rescue Exception => e
  $stderr.puts "#{e.class}: #{e.message}"
  if e.backtrace
    $stderr.puts e.backtrace.join("\\n")
  end
  1
end
      `;
      
      const result = vm.eval(wrappedCode);
      const exitCode = parseInt(result.toString(), 10);
      emitExit(exitCode);
    } catch (evalErr: any) {
      const errMsg = evalErr instanceof Error ? evalErr.message : String(evalErr);
      self.postMessage({
        type: 'output',
        channel: 'stderr',
        data: errMsg.endsWith('\\n') ? errMsg : `${errMsg}\\n`
      } satisfies WorkerToHostMessage);
      
      emitExit(1, errMsg);
    }
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
