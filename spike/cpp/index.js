const outputEl = document.getElementById('output');
const sourceEl = document.getElementById('source');
const langEl = document.getElementById('lang');
const isoStatusEl = document.getElementById('iso-status');
const isoDotEl = document.getElementById('iso-dot');
const runtimeInfoEl = document.getElementById('runtime-info');
const reportOutputEl = document.getElementById('report-output');
const metricsPanel = document.getElementById('metrics-panel');
const runButton = document.getElementById('run-btn');
const stopButton = document.getElementById('stop-btn');

const sampleMap = {
  c: `#include <stdio.h>\n\nint main(void) {\n  printf("hello from C\\n");\n  return 0;\n}\n`,
  cpp: `#include <iostream>\n\nint main() {\n  std::cout << "hello from C++\\n";\n  return 0;\n}\n`
};

const state = {
  activeWorker: null,
  activeRunId: 0,
  watchdog: null,
  progressTimer: null,
  metrics: {
    crossOriginIsolated: window.crossOriginIsolated,
    userAgent: navigator.userAgent,
    deviceMemory: navigator.deviceMemory || 'unknown',
    hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    timestamp: new Date().toISOString(),
    registryAttempts: []
  }
};

function log(message) {
  outputEl.textContent += `${message}\n`;
  outputEl.scrollTop = outputEl.scrollHeight;
}

function clearOutput() {
  outputEl.textContent = '';
}

function updateCrossOriginStatus() {
  const isolated = !!window.crossOriginIsolated;
  isoStatusEl.textContent = `crossOriginIsolated = ${isolated}`;
  isoDotEl.className = `dot ${isolated ? 'ok' : 'warn'}`;
  runtimeInfoEl.textContent = `userAgent=${navigator.userAgent} | deviceMemory=${navigator.deviceMemory ?? 'unknown'} | hardwareConcurrency=${navigator.hardwareConcurrency ?? 'unknown'}`;
}

async function loadSample() {
  const lang = langEl.value;
  sourceEl.value = sampleMap[lang];
  log(`Loaded sample for ${lang.toUpperCase()}`);
}

async function compileAndRun() {
  if (state.activeWorker) return;
  clearOutput();
  log(`crossOriginIsolated = ${window.crossOriginIsolated}`);

  if (!window.crossOriginIsolated) {
    log('Blocked: page is not cross-origin isolated; SharedArrayBuffer is unavailable.');
    throw new Error('Not cross-origin isolated');
  }

  const worker = new Worker(new URL('./worker-compile.js', import.meta.url), { type: 'module' });
  const runId = ++state.activeRunId;
  state.activeWorker = worker;
  runButton.disabled = true;
  stopButton.disabled = false;
  const startedAt = performance.now();
  state.startedAt = startedAt;

  const finished = await new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(state.watchdog);
      state.watchdog = null;
      clearInterval(state.progressTimer);
      state.progressTimer = null;
      worker.removeEventListener('message', onMessage);
      if (state.activeWorker === worker) state.activeWorker = null;
      runButton.disabled = false;
      stopButton.disabled = true;
    };
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };
    const onMessage = (event) => {
      const data = event.data;
      if (!data || !data.type || data.runId !== runId) return;
      if (data.type === 'phase') {
        log(`phase:${data.phase}`);
        if (data.phase === 'done') updateCrossOriginStatus();
        if (data.phase === 'done') {
          const result = data.result;
          state.metrics.lastRun = result;
          state.metrics.lastAction = `${langEl.value === 'c' ? 'C' : 'C++'} compile + run`;
          state.metrics.registryAttempts = [{ status: 'package-loaded', package: 'clang/clang', note: 'Resolved by the Wasmer browser SDK' }];
          reportOutputEl.value = JSON.stringify({ ...state.metrics, status: result.status, crossOriginIsolated: window.crossOriginIsolated }, null, 2);
          metricsPanel.classList.add('visible');
          log(`Compile duration: ${result.compileMs ?? 'n/a'}ms`);
          log(`Total duration: ${result.durationMs ?? 'n/a'}ms`);
          log(`WASM size: ${result.wasmBytes ?? 'not produced'} bytes`);
          log(`WASM imports: ${JSON.stringify(result.imports ?? [])}`);
          log(`WASM exports: ${JSON.stringify(result.exports ?? [])}`);
          if (result.compileStdout) log(`Compiler stdout:\n${result.compileStdout}`);
          if (result.compileStderr) log(`Compiler stderr:\n${result.compileStderr}`);
          if (result.status === 'compile-timeout') log(`Compiler timeout; compiler exit code: ${result.exitCode}; SDK reason: ${result.compileReason ?? 'unknown'}`);
          else if (result.status === 'compile-error') log(`Compiler exit code: ${result.exitCode}`);
          else log(`Program exit code: ${result.exitCode}`);
          if (result.stdout) log(`Program stdout:\n${result.stdout}`);
          if (result.stderr) log(`Program stderr:\n${result.stderr}`);
          return settle(resolve, result);
        }
        return;
      }
      if (data.type === 'log') {
        log(data.text);
        return;
      }
      if (data.type === 'progress') {
        const seconds = Math.floor(data.elapsedMs / 1000);
        isoStatusEl.textContent = `crossOriginIsolated = ${window.crossOriginIsolated} | compiling ${seconds}s`;
        return;
      }
      if (data.type === 'compiler-output') {
        log(`compiler ${data.channel}: ${data.text}`);
        return;
      }
      if (data.type === 'error') {
        log(`ERROR: ${data.message}`);
        state.metrics.lastRun = { status: 'error', error: data.message, durationMs: data.durationMs };
        state.metrics.lastAction = `${langEl.value} compile + run`;
        reportOutputEl.value = JSON.stringify({ ...state.metrics, status: 'error', crossOriginIsolated: window.crossOriginIsolated }, null, 2);
        metricsPanel.classList.add('visible');
        return settle(resolve, state.metrics.lastRun);
      }
      if (data.type === 'timed-out') {
        log(`TIMEOUT after ${data.durationMs}ms: ${data.message}`);
        state.metrics.lastRun = { status: 'timeout', durationMs: data.durationMs, message: data.message };
        reportOutputEl.value = JSON.stringify({ ...state.metrics, status: 'timeout', crossOriginIsolated: window.crossOriginIsolated }, null, 2);
        metricsPanel.classList.add('visible');
        return settle(resolve, state.metrics.lastRun);
      }
      if (data.type === 'cancelled') {
        log('CANCELLED by user.');
        state.metrics.lastRun = { status: 'cancelled', durationMs: Math.round(performance.now() - startedAt) };
        return settle(resolve, state.metrics.lastRun);
      }
    };
    worker.addEventListener('message', onMessage);
    state.progressTimer = setInterval(() => {
      const seconds = Math.floor((performance.now() - startedAt) / 1000);
      isoStatusEl.textContent = `crossOriginIsolated = ${window.crossOriginIsolated} | ${seconds}s`;
    }, 1000);
    state.watchdog = setTimeout(() => {
      log('UI watchdog expired at 20000ms; worker terminated.');
      state.metrics.lastRun = { status: 'ui-watchdog-timeout', durationMs: Math.round(performance.now() - startedAt) };
      reportOutputEl.value = JSON.stringify({ ...state.metrics, status: 'ui-watchdog-timeout', crossOriginIsolated: window.crossOriginIsolated }, null, 2);
      metricsPanel.classList.add('visible');
      updateCrossOriginStatus();
      worker.terminate();
      settle(resolve, state.metrics.lastRun);
    }, 20_000);
    worker.postMessage({ type: 'compile', source: sourceEl.value, lang: langEl.value, runId });
  });
  return finished;
}

document.getElementById('run-btn').addEventListener('click', () => {
  compileAndRun().catch((error) => {
    console.error(error);
  });
});

document.getElementById('load-sample').addEventListener('click', () => {
  loadSample();
});

document.getElementById('stop-btn').addEventListener('click', () => {
  if (state.activeWorker) {
    const worker = state.activeWorker;
    worker.terminate();
    state.activeWorker = null;
    clearTimeout(state.watchdog);
    state.watchdog = null;
    clearInterval(state.progressTimer);
    state.progressTimer = null;
    runButton.disabled = false;
    stopButton.disabled = true;
    const durationMs = Math.round(performance.now() - (state.startedAt ?? performance.now()));
    state.metrics.lastRun = { status: 'cancelled', durationMs, action: 'Stop button terminated the compiler Worker' };
    state.metrics.lastAction = 'Stop button';
    reportOutputEl.value = JSON.stringify({ ...state.metrics, status: 'cancelled', crossOriginIsolated: window.crossOriginIsolated }, null, 2);
    metricsPanel.classList.add('visible');
    log(`CANCELLED by user; compiler Worker terminated after ${durationMs}ms.`);
  }
});

document.getElementById('report-btn').addEventListener('click', () => {
  const payload = {
    ...state.metrics,
    status: 'spike-cpp-wasm',
    evaluator: 'LiCode spike',
    crossOriginIsolated: window.crossOriginIsolated,
    note: 'This report is a validation snapshot; it is not a production hardening decision.'
  };
  reportOutputEl.value = JSON.stringify(payload, null, 2);
  metricsPanel.classList.add('visible');
});

document.getElementById('copy-btn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(reportOutputEl.value);
  log('Report copied to clipboard.');
});

langEl.addEventListener('change', () => loadSample());
updateCrossOriginStatus();
stopButton.disabled = true;
loadSample();
