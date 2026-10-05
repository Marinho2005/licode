import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const { chromium } = req('playwright');

const REPO_ROOT = process.cwd();

function checkUrl(url) {
  return new Promise((resolve) => {
    const r = http.get(url, (res) => {
      resolve(res.statusCode);
    });
    r.on('error', () => resolve(null));
    r.setTimeout(2000, () => {
      r.destroy();
      resolve(null);
    });
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const code = await checkUrl(url);
    if (code !== null && code >= 200 && code < 500) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function killProcess(proc) {
  if (!proc || !proc.pid) return;
  try {
    process.kill(-proc.pid, 'SIGKILL');
  } catch {
    try {
      proc.kill('SIGKILL');
    } catch {}
  }
}

async function runS1PythonTests() {
  console.log('🚀 [S1 Python Test] Iniciando servidores apps/sandbox (5174) e apps/web (5173)...');

  const sandboxProc = spawn('pnpm', ['--filter', '@licode/sandbox', 'dev'], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: 'ignore'
  });

  const webProc = spawn('pnpm', ['--filter', '@licode/web', 'dev'], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: 'ignore'
  });

  const cleanup = () => {
    killProcess(sandboxProc);
    killProcess(webProc);
  };

  try {
    console.log('Aguardando servidores responderem...');
    const [sandboxOk, webOk] = await Promise.all([
      waitForServer('http://localhost:5174/', 30000),
      waitForServer('http://localhost:5173/', 30000)
    ]);

    if (!sandboxOk) throw new Error('Timeout aguardando http://localhost:5174/');
    if (!webOk) throw new Error('Timeout aguardando http://localhost:5173/');
    console.log('✅ Servidores dev ativos.\n');

    // -------------------------------------------------------------------------
    // Regra 2: Validação prévia via curl dos arquivos WASM e indexURL
    // -------------------------------------------------------------------------
    console.log('--- [Regra 2] Validação via curl na porta dev do sandbox (5174) ---');
    const wasmHeaders = execSync('curl -s -I http://localhost:5174/assets/pyodide/314.0.7/pyodide.asm.wasm', {
      encoding: 'utf-8'
    });
    console.log('Headers de pyodide.asm.wasm:\n' + wasmHeaders.trim());

    if (!wasmHeaders.includes('200 OK') || !wasmHeaders.toLowerCase().includes('content-type: application/wasm')) {
      throw new Error('FALHA na validação curl de pyodide.asm.wasm: status 200 ou Content-Type application/wasm ausente!');
    }
    console.log('✅ pyodide.asm.wasm responde 200 OK com Content-Type: application/wasm.');

    const otherFiles = [
      'pyodide.asm.mjs',
      'pyodide.mjs',
      'pyodide-lock.json',
      'python_stdlib.zip'
    ];

    for (const f of otherFiles) {
      const out = execSync(`curl -s -I http://localhost:5174/assets/pyodide/314.0.7/${f}`, {
        encoding: 'utf-8'
      });
      if (!out.includes('200 OK')) {
        throw new Error(`FALHA na validação curl de ${f}: resposta não foi 200 OK!`);
      }
      console.log(`✅ ${f} responde 200 OK.`);
    }

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('LiCode') || msg.type() === 'error') {
        console.log(`  [Browser ${msg.type()}]:`, text);
      }
    });

    console.log('\n--- Navegando para http://localhost:5173/?lang=python ---');
    await page.goto('http://localhost:5173/?lang=python', { timeout: 30000 });
    await page.waitForSelector('.state-ready', { timeout: 30000 });
    console.log('✅ UI conectada e runtimeState pronto (.state-ready).');

    // Helper para executar código Python pela UI
    async function executePythonUI(codeText) {
      await page.fill('.code-textarea', codeText);
      await page.click('.btn-run');
      await page.waitForSelector('.status-badge', { timeout: 25000 });
      const badgeText = await page.textContent('.status-badge');
      const logs = await page.$$eval('.log-line', (els) =>
        els.map((el) => ({
          channel: el.classList.contains('log-stderr')
            ? 'stderr'
            : el.classList.contains('log-stdout')
              ? 'stdout'
              : 'system',
          text: el.querySelector('.log-content')?.textContent?.trim() || ''
        }))
      );
      return { badgeText, logs };
    }

    // -------------------------------------------------------------------------
    // Critério 1: Hello world em Python rodou até o final
    // -------------------------------------------------------------------------
    console.log('\n--- Critério 1: Hello world em Python rodou até o final ---');
    {
      const { badgeText, logs } = await executePythonUI('print("hello world from python")');
      const hasHello = logs.some((l) => l.channel === 'stdout' && l.text.includes('hello world from python'));
      const isCode0 = badgeText?.includes('code 0');
      console.log('  Badge:', badgeText);
      console.log('  Logs:', logs);
      if (!hasHello || !isCode0) {
        throw new Error('FALHA no Critério 1: saída "hello world from python" ou code 0 não encontrados.');
      }
      console.log('✅ Critério 1 APROVADO: Hello world rodou com sucesso e encerrou com exit code 0.');
    }

    // -------------------------------------------------------------------------
    // Critério 2: Loop infinito encerrado em ~3s com reason 'timeout'
    // -------------------------------------------------------------------------
    console.log('\n--- Critério 2: while True: pass encerrado com timeout ---');
    {
      const start = Date.now();
      const { badgeText, logs } = await executePythonUI('while True:\n    pass');
      const durationMs = Date.now() - start;
      console.log(`  Duração: ${durationMs}ms`);
      console.log('  Badge:', badgeText);
      console.log('  Logs:', logs);
      const isTimeout = badgeText?.includes('timeout') && badgeText?.includes('code 124');
      if (!isTimeout) {
        throw new Error(`FALHA no Critério 2: esperado timeout / code 124, obtido: ${badgeText}`);
      }
      console.log(`✅ Critério 2 APROVADO: loop infinito interrompido em ${durationMs}ms com reason: timeout (code 124).`);
    }

    // -------------------------------------------------------------------------
    // Critério 3: Loop de print cortado por limite de saída ('output-limit')
    // -------------------------------------------------------------------------
    console.log('\n--- Critério 3: Loop de print cortado por limite de saída ---');
    {
      const spamCode = 'while True:\n    print("spam " * 50)';
      const { badgeText, logs } = await executePythonUI(spamCode);
      console.log('  Badge:', badgeText);
      const hasOutputLimit = badgeText?.includes('output-limit') && badgeText?.includes('code 137');
      const hasWarning = logs.some((l) => l.channel === 'stderr' && l.text.includes('Output limit exceeded'));
      if (!hasOutputLimit || !hasWarning) {
        throw new Error(`FALHA no Critério 3: esperado output-limit (code 137), obtido: ${badgeText}`);
      }
      console.log('✅ Critério 3 APROVADO: excesso de logs encerrado com reason: output-limit (code 137).');
    }

    // -------------------------------------------------------------------------
    // Critério 4: Erro no script Python (1/0) -> stderr e exit code != 0
    // -------------------------------------------------------------------------
    console.log('\n--- Critério 4: Erro no script Python (1/0) ---');
    {
      const { badgeText, logs } = await executePythonUI('print("antes da divisao")\n1/0');
      console.log('  Badge:', badgeText);
      console.log('  Logs:', logs);
      const hasZeroDivision = logs.some((l) => l.channel === 'stderr' && l.text.includes('ZeroDivisionError'));
      const isErrorCode = badgeText?.includes('code 1') && badgeText?.includes('error');
      if (!hasZeroDivision || !isErrorCode) {
        throw new Error('FALHA no Critério 4: ZeroDivisionError em stderr ou exit code 1 não encontrados.');
      }
      console.log('✅ Critério 4 APROVADO: Erro 1/0 capturado em stderr com ZeroDivisionError e code 1.');
    }

    // -------------------------------------------------------------------------
    // Critério 5: Signal Stop mata a execução na hora
    // -------------------------------------------------------------------------
    console.log('\n--- Critério 5: Signal Stop mata a execução na hora ---');
    {
      await page.fill('.code-textarea', 'import time\nwhile True:\n    time.sleep(0.1)');
      await page.click('.btn-run');
      await page.waitForSelector('.phase-running', { timeout: 15000 });

      const stopStart = Date.now();
      await page.click('.btn-stop');
      await page.waitForSelector('.reason-killed', { timeout: 5000 });
      const stopDuration = Date.now() - stopStart;
      const badgeText = await page.textContent('.status-badge');
      console.log(`  Tempo para parar: ${stopDuration}ms`);
      console.log('  Badge:', badgeText);

      const isKilled = badgeText?.includes('killed') && badgeText?.includes('code 137');
      if (!isKilled) {
        throw new Error(`FALHA no Critério 5: esperado killed (code 137), obtido: ${badgeText}`);
      }
      console.log(`✅ Critério 5 APROVADO: Execução interrompida imediatamente (${stopDuration}ms) com reason: killed.`);
    }

    // -------------------------------------------------------------------------
    // Critério 6: Baseline da fase 1 (JavaScript) continua passando verde
    // -------------------------------------------------------------------------
    console.log('\n--- Critério 6: Baseline da fase 1 (JavaScript) via __licode_ide ---');
    {
      const jsResult = await page.evaluate(async () => {
        const ide = window.__licode_ide;
        if (!ide) throw new Error('ideEnv não encontrado em window.__licode_ide');

        const session = await ide.manager.startSession('javascript', {
          files: { 'index.js': 'console.log("js baseline ok");' },
          entry: 'index.js',
          limits: { wallMs: 3000 }
        });

        let stdout = '';
        let exitEvent = null;

        for await (const ev of session.events) {
          if (ev.t === 'stdout') stdout += ev.data;
          else if (ev.t === 'exit') exitEvent = ev;
        }

        return { stdout, exitEvent };
      });

      console.log('  Resultado JS:', jsResult);
      if (!jsResult.stdout.includes('js baseline ok') || jsResult.exitEvent?.code !== 0) {
        throw new Error('FALHA no Critério 6: Baseline JS não executou com sucesso!');
      }
      console.log('✅ Critério 6 APROVADO: Baseline JS continua 100% verde.');
    }

    await browser.close();

    console.log('\n======================================================');
    console.log('🎉 TODOS OS CRITÉRIOS DE ACEITE S1 PYTHON PASSARAM COM SUCESSO!');
    console.log('======================================================\n');
  } finally {
    cleanup();
    setTimeout(() => process.exit(0), 500);
  }
}

runS1PythonTests().catch((err) => {
  console.error('\n❌ ERRO NO TESTE S1 PYTHON:', err);
  process.exit(1);
});
