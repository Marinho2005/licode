import { chromium } from 'playwright';

async function runDockerAcceptanceTests() {
  console.log('🚀 Iniciando testes de aceitação contra ambiente Docker em http://localhost:8080...');

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
    console.log('Acessando UI em http://localhost:8080...');
    await page.goto('http://localhost:8080');

    // 1. Valida handshake no container Docker
    console.log('Aguardando handshake da UI (8080) com Sandbox (8081)...');
    await page.waitForSelector('.state-ready', { timeout: 15000 });
    console.log('✅ Handshake UI (8080) <-> Sandbox (8081) estabelecido com sucesso!');

    async function executeCode(codeText) {
      await page.fill('.code-textarea', codeText);
      await page.click('.btn-run');
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
    // CRITÉRIO: console.log("oi")
    // ----------------------------------------------------
    console.log('\n--- 1. Testando console.log("oi") no Docker ---');
    {
      const { badgeText, logs } = await executeCode('console.log("oi");');
      const hasOi = logs.some((l) => l.channel === 'stdout' && l.text.includes('oi'));
      const isCode0 = badgeText?.includes('code 0');
      console.log('Badge:', badgeText);
      console.log('Logs:', logs);
      if (hasOi && isCode0) {
        console.log('✅ CRITÉRIO APROVADO: console.log("oi") exibido com sucesso no Docker!');
        results.push({ test: 'console.log("oi")', passed: true, detail: 'Mostrou "oi" e encerrou com code 0' });
      } else {
        throw new Error('Falha no teste console.log("oi")');
      }
    }

    // ----------------------------------------------------
    // CRITÉRIO: while(true){} encerra em 3s com 'timeout'
    // ----------------------------------------------------
    console.log('\n--- 2. Testando while(true){} com Timeout 3s no Docker ---');
    {
      const startTime = Date.now();
      const { badgeText, logs } = await executeCode('while (true) {}');
      const durationMs = Date.now() - startTime;
      console.log(`Duração da execução: ${durationMs}ms`);
      console.log('Badge:', badgeText);
      console.log('Logs:', logs);

      const hasTimeout = badgeText?.includes('timeout') && badgeText?.includes('code 124');
      const durationInRange = durationMs >= 2800 && durationMs <= 5000;
      if (hasTimeout && durationInRange) {
        console.log('✅ CRITÉRIO APROVADO: Timeout de 3s no Docker encerrou o loop com sucesso!');
        results.push({ test: 'while(true) timeout', passed: true, detail: `Encerrado em ${durationMs}ms com timeout (code 124)` });
      } else {
        throw new Error(`Falha no teste while(true) (${badgeText}, ${durationMs}ms)`);
      }
    }

    // ----------------------------------------------------
    // CRITÉRIO: Isolamento de segurança (window/document/localStorage)
    // ----------------------------------------------------
    console.log('\n--- 3. Testando Isolamento de Segurança no Docker ---');
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
      console.log('Badge:', badgeText);
      console.log('Logs:', logs);

      const isWindowUndefined = logs.some((l) => l.text.includes('window_check: undefined'));
      const isDocUndefined = logs.some((l) => l.text.includes('doc_check: undefined'));
      const isStorageUndefined = logs.some((l) => l.text.includes('storage_check: undefined'));

      if (isWindowUndefined && isDocUndefined && isStorageUndefined) {
        console.log('✅ CRITÉRIO APROVADO: Isolamento total confirmado no Docker (window/document/localStorage inacessíveis)!');
        results.push({ test: 'security isolation', passed: true, detail: 'window, document e localStorage são undefined' });
      } else {
        throw new Error('Falha no teste de isolamento de segurança');
      }
    }

    console.log('\n========================================');
    console.log('🎉 TODOS OS TESTES NO DOCKER PASSARAM COM SUCESSO!');
    console.log('========================================');
    console.table(results);
  } finally {
    await browser.close();
  }
}

runDockerAcceptanceTests().catch((err) => {
  console.error('\n❌ ERRO NOS TESTES DOCKER:', err);
  process.exit(1);
});
