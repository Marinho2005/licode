import { spawn } from 'node:child_process';
import http from 'node:http';
import { chromium } from 'playwright';

function checkUrl(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode);
    }).on('error', () => {
      resolve(null);
    });
  });
}

async function waitForServer(url, timeoutMs = 15000) {
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
    proc.kill('SIGTERM');
  } catch {}
}

async function runAcceptanceTests() {
  console.log('🚀 Iniciando servidores apps/sandbox (5174) e apps/web (5173)...');

  const sandboxProc = spawn('pnpm', ['--filter', '@licode/sandbox', 'dev'], {
    cwd: process.cwd(),
    detached: false
  });

  const webProc = spawn('pnpm', ['--filter', '@licode/web', 'dev'], {
    cwd: process.cwd(),
    detached: false
  });

  console.log('Aguardando servidores responderem HTTP...');
  const sandboxOk = await waitForServer('http://localhost:5174/');
  if (!sandboxOk) throw new Error('Timeout aguardando http://localhost:5174/');
  console.log('✅ apps/sandbox respondendo HTTP em http://localhost:5174/');

  const webOk = await waitForServer('http://localhost:5173/');
  if (!webOk) throw new Error('Timeout aguardando http://localhost:5173/');
  console.log('✅ apps/web respondendo HTTP em http://localhost:5173/');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('LiCode')) {
      console.log(`[Browser Console ${msg.type()}]:`, msg.text());
    }
  });

  const results = [];

  try {
    console.log('Navegando para http://localhost:5173...');
    await page.goto('http://localhost:5173');

    // Aguarda o handshake ser concluído e o estado ficar 'ready'
    console.log('Aguardando runtimeState ficar ready...');
    await page.waitForSelector('.state-ready', { timeout: 10000 });
    console.log('✅ Handshake inicial UI <-> Sandbox estabelecido com sucesso! (.state-ready)');

    // Helper para executar código e aguardar término
    async function executeCode(codeText) {
      await page.fill('.code-textarea', codeText);
      await page.click('.btn-run');
      // Aguarda a conclusão da sessão (exibição do status-badge)
      await page.waitForSelector('.status-badge', { timeout: 15000 });
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

    // ----------------------------------------------------
    // CRITÉRIO 1: console.log("oi")
    // ----------------------------------------------------
    console.log('\n--- Testando Critério 1: console.log("oi") ---');
    {
      const { badgeText, logs } = await executeCode('console.log("oi");');
      const hasOi = logs.some((l) => l.channel === 'stdout' && l.text.includes('oi'));
      const isCode0 = badgeText?.includes('code 0');
      console.log('Logs obtidos:', logs);
      console.log('Status badge:', badgeText);
      if (hasOi && isCode0) {
        console.log('✅ CRITÉRIO 1 APROVADO: "oi" impresso com exit code 0.');
        results.push({ criterion: 1, passed: true, detail: 'Mostrou "oi" e encerrou com code 0' });
      } else {
        throw new Error('Falha no Critério 1: saída "oi" ou code 0 não encontrados.');
      }
    }

    // ----------------------------------------------------
    // CRITÉRIO 2: while(true){} encerra em 3s com 'timeout'
    // ----------------------------------------------------
    console.log('\n--- Testando Critério 2: while(true){} com Timeout 3s ---');
    {
      const startTime = Date.now();
      const { badgeText, logs } = await executeCode('while (true) {}');
      const durationMs = Date.now() - startTime;
      console.log(`Duração da execução: ${durationMs}ms`);
      console.log('Logs obtidos:', logs);
      console.log('Status badge:', badgeText);

      const hasTimeoutReason = badgeText?.includes('timeout') && badgeText?.includes('code 124');
      const durationInRange = durationMs >= 2800 && durationMs <= 5000;
      if (hasTimeoutReason && durationInRange) {
        console.log('✅ CRITÉRIO 2 APROVADO: loop encerrado pelo host com reason timeout em ~3s.');
        results.push({ criterion: 2, passed: true, detail: `Encerrado em ${durationMs}ms com timeout (code 124)` });
      } else {
        throw new Error(`Falha no Critério 2: reason ou tempo divergente (${badgeText}, ${durationMs}ms).`);
      }
    }

    // ----------------------------------------------------
    // CRITÉRIO 3: loop infinito de console.log cortado por output-limit
    // ----------------------------------------------------
    console.log('\n--- Testando Critério 3: Flood de console.log (Output Limit) ---');
    {
      const { badgeText, logs } = await executeCode(
        'let i = 0; while (true) { console.log("spam data #" + (++i) + " - flood test chunk string padding"); }'
      );
      console.log('Status badge:', badgeText);
      console.log('Últimos 3 logs:', logs.slice(-3));

      const hasOutputLimit = badgeText?.includes('output-limit');
      const hasLimitNotice = logs.some((l) => l.text.includes('Output limit exceeded'));
      if (hasOutputLimit && hasLimitNotice) {
        console.log('✅ CRITÉRIO 3 APROVADO: loop cortado por limite de saída sem travar a aba.');
        results.push({ criterion: 3, passed: true, detail: 'Encerrado com reason output-limit e aviso de truncamento' });
      } else {
        throw new Error(`Falha no Critério 3: esperado output-limit, obteve ${badgeText}`);
      }
    }

    // ----------------------------------------------------
    // CRITÉRIO 4: Throw de erro em stderr com exit code != 0
    // ----------------------------------------------------
    console.log('\n--- Testando Critério 4: Throw de erro capturado em stderr ---');
    {
      const { badgeText, logs } = await executeCode('throw new Error("Erro intencional de teste!");');
      console.log('Status badge:', badgeText);
      console.log('Logs obtidos:', logs);

      const hasStderr = logs.some((l) => l.channel === 'stderr' && l.text.includes('Erro intencional de teste!'));
      const isErrorCode = badgeText?.includes('code 1') && badgeText?.includes('error');
      if (hasStderr && isErrorCode) {
        console.log('✅ CRITÉRIO 4 APROVADO: erro capturado em stderr com exit code 1.');
        results.push({ criterion: 4, passed: true, detail: 'Stack trace em stderr com code 1 e reason error' });
      } else {
        throw new Error(`Falha no Critério 4: esperado stderr com erro, obteve ${badgeText}`);
      }
    }

    // ----------------------------------------------------
    // CRITÉRIO 5: window/document/localStorage inacessíveis
    // ----------------------------------------------------
    console.log('\n--- Testando Critério 5: Isolamento de Segurança ---');
    {
      const securityCode = `
        try {
          console.log("window_check:", typeof window);
        } catch (e) {
          console.error("window_err:", e.message);
        }

        try {
          console.log("doc_check:", typeof document);
        } catch (e) {
          console.error("doc_err:", e.message);
        }

        try {
          console.log("storage_check:", typeof localStorage);
        } catch (e) {
          console.error("storage_err:", e.message);
        }
      `;
      const { badgeText, logs } = await executeCode(securityCode);
      console.log('Status badge:', badgeText);
      console.log('Logs obtidos:', logs);

      const isWindowUndefined = logs.some((l) => l.text.includes('window_check: undefined'));
      const isDocUndefined = logs.some((l) => l.text.includes('doc_check: undefined'));
      const isStorageUndefined = logs.some((l) => l.text.includes('storage_check: undefined'));

      if (isWindowUndefined && isDocUndefined && isStorageUndefined) {
        console.log('✅ CRITÉRIO 5 APROVADO: window, document e localStorage são totalmente inacessíveis (undefined).');
        results.push({
          criterion: 5,
          passed: true,
          detail: 'window, document e localStorage são undefined no worker'
        });
      } else {
        throw new Error('Falha no Critério 5: variáveis globais do DOM vazaram no ambiente do worker.');
      }
    }

    // ----------------------------------------------------
    // CRITÉRIO 6: Stop mata a execução imediatamente
    // ----------------------------------------------------
    console.log('\n--- Testando Critério 6: Stop mata execução imediatamente ---');
    {
      await page.fill(
        '.code-textarea',
        'console.log("Iniciando loop assíncrono..."); let count = 0; while (true) { console.log("Tick #" + (++count)); await new Promise(r => setTimeout(r, 100)); }'
      );
      await page.click('.btn-run');

      // Aguarda o primeiro log aparecer
      await page.waitForFunction(() => {
        const text = document.querySelector('.console-body')?.textContent || '';
        return text.includes('Iniciando loop assíncrono...');
      });

      // Clica em Stop
      const stopTime = Date.now();
      await page.click('.btn-stop');
      await page.waitForSelector('.reason-killed', { timeout: 3000 });
      const durationMs = Date.now() - stopTime;

      const badgeText = await page.textContent('.status-badge');
      console.log(`Duração do Stop: ${durationMs}ms`);
      console.log('Status badge:', badgeText);

      const hasKilled = badgeText?.includes('killed') && badgeText?.includes('code 137');
      if (hasKilled && durationMs < 1000) {
        console.log('✅ CRITÉRIO 6 APROVADO: Stop encerrou a execução imediatamente com reason: killed.');
        results.push({ criterion: 6, passed: true, detail: `Encerrado em ${durationMs}ms com SIGKILL e code 137` });
      } else {
        throw new Error(`Falha no Critério 6: esperado killed imediato, obteve ${badgeText}`);
      }
    }

    // ----------------------------------------------------
    // TESTE DO REQUISITO 1: Worker com atributo sandbox no iframe
    // ----------------------------------------------------
    console.log('\n--- Testando Requisito 1: Investigação do atributo sandbox no Iframe ---');
    {
      const sandboxTestResult = await page.evaluate(async () => {
        const testIframe = document.createElement('iframe');
        testIframe.setAttribute('sandbox', 'allow-scripts');
        testIframe.srcdoc = `
          <script>
            try {
              const blob = new Blob(["postMessage('worker-ok');"], { type: 'application/javascript' });
              const worker = new Worker(URL.createObjectURL(blob));
              worker.onmessage = () => window.parent.postMessage({ type: 'test-sandbox-worker', status: 'success' }, '*');
              worker.onerror = (e) => window.parent.postMessage({ type: 'test-sandbox-worker', status: 'error', message: e.message }, '*');
            } catch (err) {
              window.parent.postMessage({ type: 'test-sandbox-worker', status: 'exception', message: err.name + ': ' + err.message }, '*');
            }
          </script>
        `;

        const promise = new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve({ status: 'timeout', message: 'Worker creation timed out or was silently blocked' });
          }, 3000);

          window.addEventListener('message', function handler(ev) {
            if (ev.data && ev.data.type === 'test-sandbox-worker') {
              clearTimeout(timeout);
              window.removeEventListener('message', handler);
              resolve(ev.data);
            }
          });
        });

        document.body.appendChild(testIframe);
        const res = await promise;
        testIframe.remove();
        return res;
      });

      console.log('Resultado do teste de Worker com sandbox="allow-scripts":', sandboxTestResult);
      results.push({
        requirement: 'iframe-sandbox-investigation',
        detail: sandboxTestResult
      });
    }

    console.log('\n========================================');
    console.log('🎉 TODOS OS TESTES E CRITÉRIOS PASSARAM COM SUCESSO!');
    console.log('========================================');
    console.table(results);
  } finally {
    await browser.close();
    killProcess(sandboxProc);
    killProcess(webProc);
    try {
      const fkill = spawn('fuser', ['-k', '5173/tcp', '5174/tcp']);
      await new Promise((r) => fkill.on('close', r));
    } catch {}
  }
}

runAcceptanceTests().catch((err) => {
  console.error('\n❌ ERRO NA SUITE DE ACEITAÇÃO:', err);
  process.exit(1);
});
