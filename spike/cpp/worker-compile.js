import { Wasmer } from './node_modules/@wasmer/sdk/dist/index.js';

const SANDBOX_TIMEOUT_MS = 45_000;
const COMMAND_TIMEOUT_MS = 30_000;
const PROGRESS_INTERVAL_MS = 5_000;
let activeRun = null;

function send(type, payload = {}) {
  self.postMessage({ type, ...payload });
}

self.onmessage = async (event) => {
  const { type, source, lang, runId } = event.data || {};

  if (type === 'cancel') {
    if (activeRun?.runId === runId) {
      activeRun.cancelled = true;
      activeRun.controller.abort(new Error('Cancelled by user'));
      activeRun.process?.kill().catch(() => {});
      activeRun.sandbox?.close().catch(() => {});
      activeRun.wasmer?.close().catch(() => {});
      send('cancelled', { runId });
    }
    return;
  }

  if (type !== 'compile' || activeRun) return;

  const run = {
    runId,
    controller: new AbortController(),
    cancelled: false,
    wasmer: null,
    sandbox: null
  };
  activeRun = run;
  const startedAt = performance.now();
  let timeoutId;
  let progressId;
  let commandTimer;

  try {
    send('phase', { phase: 'compiling', runId });
    timeoutId = setTimeout(() => {
      run.controller.abort(new Error(`Compile/run timed out after ${SANDBOX_TIMEOUT_MS}ms`));
      run.process?.kill().catch(() => {});
      run.sandbox?.close().catch(() => {});
    }, SANDBOX_TIMEOUT_MS);
    progressId = setInterval(() => {
      send('progress', { runId, elapsedMs: Math.round(performance.now() - startedAt) });
    }, PROGRESS_INTERVAL_MS);

    const isCpp = lang === 'cpp';
    const fileName = isCpp ? 'main.cpp' : 'main.c';
    const compiler = 'clang';
    const compileArgs = [
      ...(isCpp ? ['-std=c++17'] : []),
      '-target', 'wasm32-wasi',
      '-O0', '-g0',
      '-Wl,--export=main',
      `/workspace/${fileName}`,
      '-o', '/workspace/main.wasm'
    ];

    run.wasmer = new Wasmer();
    run.sandbox = await run.wasmer.sandboxes.create({
      packages: ['clang/clang'],
      signal: run.controller.signal,
      files: { [fileName]: source },
      network: { mode: 'disabled' }
    });

    const compileStartedAt = performance.now();
    let forcedCompileTimeout = false;
    run.process = await run.sandbox.command(compiler, compileArgs).spawn({
      stdin: 'closed',
      stdout: 'pipe',
      stderr: 'pipe',
      timeoutMs: COMMAND_TIMEOUT_MS
    });
    commandTimer = setTimeout(() => {
      forcedCompileTimeout = true;
      run.process?.kill().catch(() => {});
    }, COMMAND_TIMEOUT_MS);
    let compileStdout = '';
    let compileStderr = '';
    const collect = async (stream, channel) => {
      if (!stream) return;
      const decoder = new TextDecoder();
      for await (const chunk of stream) {
        const text = decoder.decode(chunk, { stream: true });
        if (channel === 'stdout') compileStdout += text;
        else compileStderr += text;
        if (text) send('compiler-output', { runId, channel, text });
      }
      const tail = decoder.decode();
      if (tail) {
        if (channel === 'stdout') compileStdout += tail;
        else compileStderr += tail;
        send('compiler-output', { runId, channel, text: tail });
      }
    };
    const streamsDone = Promise.all([
      collect(run.process.stdout, 'stdout'),
      collect(run.process.stderr, 'stderr')
    ]);
    const [compile] = await Promise.all([run.process.wait({ check: false }), streamsDone]);
    clearTimeout(commandTimer);
    commandTimer = null;
    const compileMs = Math.round(performance.now() - compileStartedAt);
    const compileTimedOut = forcedCompileTimeout || compile.reason === 'timeout' || compile.exitCode === 137;

    if (compile.exitCode !== 0 || compileTimedOut) {
      send('phase', {
        phase: 'done',
        runId,
        result: {
          exitCode: compile.exitCode,
          stdout: '',
          stderr: '',
          compileStdout,
          compileStderr,
          compileMs,
          durationMs: Math.round(performance.now() - startedAt),
          wasmBytes: null,
          imports: [],
          exports: [],
          status: compileTimedOut ? 'compile-timeout' : 'compile-error',
          compileReason: compile.reason
        }
      });
      return;
    }

    const wasmBytes = await run.sandbox.fs.readFile('/workspace/main.wasm');
    const module = await WebAssembly.compile(wasmBytes);
    const imports = WebAssembly.Module.imports(module);
    const exports = WebAssembly.Module.exports(module);
    send('log', {
      runId,
      text: `WASM imports (${imports.length}):\n${JSON.stringify(imports, null, 2)}\nWASM exports (${exports.length}):\n${JSON.stringify(exports, null, 2)}`
    });

    // The Wasmer SDK uses the matching WASI/WASIX runtime for the compiler's
    // output. browser_wasi_shim implements preview1 only and cannot satisfy
    // this compiler package's env + wasix_32v1 imports.
    const programPackage = await run.wasmer.packages.create({
      modules: { 'main.wasm': wasmBytes },
      commands: { main: { module: 'main.wasm' } },
      entrypoint: 'main'
    });
    await run.sandbox.installPackage(programPackage);

    send('phase', { phase: 'running', runId });
    const execution = await run.sandbox.command('main').run({
      check: false,
      timeoutMs: COMMAND_TIMEOUT_MS
    });

    const result = {
      exitCode: execution.exitCode,
      stdout: execution.stdout.text(),
      stderr: execution.stderr.text(),
      compileStdout,
      compileStderr,
      compileMs,
      durationMs: Math.round(performance.now() - startedAt),
      wasmBytes: wasmBytes.byteLength,
      imports,
      exports,
      status: 'executed'
    };
    send('phase', { phase: 'done', runId, result });
  } catch (error) {
    if (run.cancelled || run.controller.signal.aborted) {
      if (!run.cancelled) {
        send('timed-out', {
          runId,
          message: `Compile/run timed out after ${SANDBOX_TIMEOUT_MS}ms`,
          durationMs: Math.round(performance.now() - startedAt)
        });
      }
    } else {
      const message = error instanceof Error ? error.message : String(error);
      send('error', { runId, message, durationMs: Math.round(performance.now() - startedAt) });
    }
  } finally {
    clearTimeout(timeoutId);
    clearInterval(progressId);
    clearTimeout(commandTimer);
    await run.sandbox?.close().catch(() => {});
    await run.wasmer?.close().catch(() => {});
    if (activeRun === run) activeRun = null;
    self.close();
  }
};
