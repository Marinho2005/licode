import { Wasmer } from '@wasmer/sdk';
import type { WorkerInitMessage, WorkerToHostMessage } from '@licode/protocol';

const COMPILER_TIMEOUT_MS = 60_000;

function post(message: WorkerToHostMessage): void {
  self.postMessage(message);
}

self.addEventListener('message', async (event: MessageEvent<WorkerInitMessage>) => {
  const { files, entry } = event.data;
  const source = files[entry] ?? '';
  let wasmer: Wasmer | undefined;
  let sandbox: Awaited<ReturnType<Wasmer['sandboxes']['create']>> | undefined;
  try {
    post({ type: 'phase', phase: 'compiling' });
    wasmer = new Wasmer();
    sandbox = await wasmer.sandboxes.create({
      packages: ['clang/clang'],
      files: { 'main.c': source },
      network: { mode: 'disabled' }
    });

    const process = await sandbox.command('clang', [
      '-target', 'wasm32-wasi', '-O0', '-g0', '-Wl,--export=main',
      '/workspace/main.c', '-o', '/workspace/main.wasm'
    ]).spawn({ stdin: 'closed', stdout: 'pipe', stderr: 'pipe', timeoutMs: COMPILER_TIMEOUT_MS });
    let compileStdout = '';
    let compileStderr = '';
    const collect = async (stream: AsyncIterable<Uint8Array> | null, channel: 'stdout' | 'stderr') => {
      if (!stream) return;
      const decoder = new TextDecoder();
      for await (const chunk of stream) {
        const text = decoder.decode(chunk, { stream: true });
        if (channel === 'stdout') compileStdout += text;
        else compileStderr += text;
      }
      const tail = decoder.decode();
      if (channel === 'stdout') compileStdout += tail;
      else compileStderr += tail;
    };
    const [, , compiled] = await Promise.all([
      collect(process.stdout, 'stdout'),
      collect(process.stderr, 'stderr'),
      process.wait({ check: false })
    ]);
    if (compileStdout) post({ type: 'output', channel: 'stdout', data: compileStdout });
    if (compileStderr) post({ type: 'output', channel: 'stderr', data: compileStderr });
    if (compiled.exitCode !== 0) {
      post({ type: 'exit', code: compiled.exitCode });
      return;
    }

    const wasmBytes = await sandbox.fs.readFile('/workspace/main.wasm');
    const program = await wasmer.packages.create({
      modules: { 'main.wasm': wasmBytes },
      commands: { main: { module: 'main.wasm' } },
      entrypoint: 'main'
    });
    await sandbox.installPackage(program);
    post({ type: 'phase', phase: 'running' });
    const execution = await sandbox.command('main').run({ check: false, timeoutMs: 30_000 });
    if (execution.stdout.text()) post({ type: 'output', channel: 'stdout', data: execution.stdout.text() });
    if (execution.stderr.text()) post({ type: 'output', channel: 'stderr', data: execution.stderr.text() });
    post({ type: 'exit', code: execution.exitCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    post({ type: 'output', channel: 'stderr', data: `${message}\n` });
    post({ type: 'exit', code: 1, error: message });
  } finally {
    await sandbox?.close().catch(() => {});
    await wasmer?.close().catch(() => {});
    self.close();
  }
});
