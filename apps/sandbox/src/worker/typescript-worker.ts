import type { WorkerInitMessage, WorkerToHostMessage } from '@licode/protocol';
import ts from 'typescript';

function formatArg(arg: unknown): string {
  if (arg === undefined) return 'undefined';
  if (arg === null) return 'null';
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'number' || typeof arg === 'boolean' || typeof arg === 'bigint') {
    return String(arg);
  }
  if (arg instanceof Error) {
    return arg.stack || `${arg.name}: ${arg.message}`;
  }
  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
}

function hookConsole(channel: 'stdout' | 'stderr', originalFn: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    // Mantém logs locais de depuração caso devtools esteja aberto
    try {
      originalFn(...args);
    } catch {}

    const text = args.map(formatArg).join(' ') + '\n';
    const msg: WorkerToHostMessage = {
      type: 'output',
      channel,
      data: text
    };
    self.postMessage(msg);
  };
}

const origLog = console.log;
const origInfo = console.info;
const origWarn = console.warn;
const origError = console.error;

console.log = hookConsole('stdout', origLog);
console.info = hookConsole('stdout', origInfo);
console.warn = hookConsole('stderr', origWarn);
console.error = hookConsole('stderr', origError);

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

// Captura erros globais assíncronos
self.addEventListener('error', (ev: ErrorEvent) => {
  const errMsg = ev.error ? formatArg(ev.error) : (ev.message || 'Unknown runtime error');
  console.error(errMsg);
  emitExit(1, errMsg);
});

self.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
  const reason = ev.reason ? formatArg(ev.reason) : 'Unhandled promise rejection';
  console.error('Unhandled Promise Rejection:', reason);
  emitExit(1, reason);
});

self.addEventListener('message', async (ev: MessageEvent<WorkerInitMessage>) => {
  const { files, entry } = ev.data;

  let code = files[entry] || '';

  try {
    const transpiled = ts.transpileModule(code, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
    });
    code = transpiled.outputText;
    const diagnostics = transpiled.diagnostics ?? [];
    if (diagnostics.some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)) {
      throw new Error(ts.formatDiagnostics(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => '/',
        getNewLine: () => '\n'
      }));
    }
    self.postMessage({ type: 'phase', phase: 'running' } satisfies WorkerToHostMessage);
    // Executa o código em escopo estrito
    // Function construtor executa no escopo global do Worker
    const executor = new Function(
      `"use strict";
       return (async () => {
         ${code}
       })();`
    );

    const result = await executor();
    // Aguarda microtasks pendentes
    await new Promise((resolve) => setTimeout(resolve, 0));
    emitExit(0);
  } catch (err: unknown) {
    const errorText = formatArg(err);
    console.error(errorText);
    emitExit(1, errorText);
  }
});
