import { spawn } from 'node:child_process';
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

async function runSecurityTests() {
  console.log('🚀 [S0 Security Test] Iniciando servidores apps/sandbox (5174) e apps/web (5173)...');

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
    console.log('✅ Servidores dev ativos.');

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // -------------------------------------------------------------------------
    // Cenário (a): Um init postMessage forjado de uma origem não permitida é ignorado
    // -------------------------------------------------------------------------
    console.log('\n--- Cenário (a): Testando rejeição de postMessage de origem não autorizada ---');
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    let warnedUnauthorized = false;
    pageA.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[LiCode Sandbox Security] Handshake rejeitado') || text.includes('Handshake rejeitado')) {
        warnedUnauthorized = true;
        console.log('  [Console Sandbox esperado]:', text);
      }
    });

    // Acessa via 127.0.0.1 (origem não permitida por default, permitidas são localhost:5173 e localhost:8080)
    await pageA.goto('http://127.0.0.1:5173');

    const unauthorizedResult = await pageA.evaluate(async () => {
      // Cria um iframe apontando para o sandbox
      const iframe = document.createElement('iframe');
      iframe.src = 'http://localhost:5174';
      document.body.appendChild(iframe);
      await new Promise((r) => (iframe.onload = r));

      const channel = new MessageChannel();
      let receivedAck = false;

      channel.port1.onmessage = () => {
        receivedAck = true;
      };
      channel.port1.start();

      // Envia handshake-init forjado a partir de http://127.0.0.1:5173 (não autorizada)
      iframe.contentWindow.postMessage(
        { type: 'licode:handshake-init', version: '1.0.0' },
        'http://localhost:5174',
        [channel.port2]
      );

      // Aguarda 1.5s para verificar se o sandbox ignora
      await new Promise((r) => setTimeout(r, 1500));
      return { receivedAck };
    });

    if (unauthorizedResult.receivedAck) {
      throw new Error('FALHA: Sandbox respondeu handshake-init de origem não autorizada!');
    }
    console.log('✅ Cenário (a) APROVADO: postMessage de origem não permitida foi ignorado e nenhum ack foi emitido.');

    // -------------------------------------------------------------------------
    // Cenário (b): O init legítimo da UI web funciona
    // -------------------------------------------------------------------------
    console.log('\n--- Cenário (b): Testando handshake legítimo da UI web ---');
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await pageB.goto('http://localhost:5173');
    await pageB.waitForSelector('.state-ready', { timeout: 15000 });
    console.log('✅ Cenário (b) APROVADO: UI web oficial (http://localhost:5173) estabeleceu handshake e atingiu .state-ready.');

    // -------------------------------------------------------------------------
    // Cenário (b2): Testando que um segundo handshake-init é ignorado (aceita apenas 1x)
    // -------------------------------------------------------------------------
    console.log('\n--- Cenário (b2): Testando rejeição de segundo handshake-init (single handshake) ---');
    let secondInitIgnoredLogged = false;
    pageB.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('Handshake ignorado: já existe um handshake ativo')) {
        secondInitIgnoredLogged = true;
        console.log('  [Console Sandbox esperado]:', text);
      }
    });

    const secondInitResult = await pageB.evaluate(async () => {
      const iframe = document.querySelector('iframe.sandbox-iframe');
      if (!iframe || !iframe.contentWindow) return { error: 'iframe não encontrado' };

      const channel = new MessageChannel();
      let receivedSecondAck = false;

      channel.port1.onmessage = () => {
        receivedSecondAck = true;
      };
      channel.port1.start();

      iframe.contentWindow.postMessage(
        { type: 'licode:handshake-init', version: '1.0.0' },
        'http://localhost:5174',
        [channel.port2]
      );

      await new Promise((r) => setTimeout(r, 1000));
      return { receivedSecondAck };
    });

    if (secondInitResult.receivedSecondAck) {
      throw new Error('FALHA: Sandbox aceitou um segundo handshake-init após já estar conectado!');
    }
    console.log('✅ Cenário (b2) APROVADO: Segunda tentativa de handshake-init foi ignorada pelo sandbox.');

    // -------------------------------------------------------------------------
    // Cenário (c): Tentar abrir com sandboxUrl igual à origem recusa carregar
    // -------------------------------------------------------------------------
    console.log('\n--- Cenário (c): Testando recusa quando sandboxUrl tem a mesma origem do web ---');
    const contextC = await browser.newContext();
    const pageC = await contextC.newPage();

    let pageErrorCaught = false;
    let pageErrorMessage = '';
    pageC.on('pageerror', (err) => {
      pageErrorCaught = true;
      pageErrorMessage = err.message;
      console.log('  [Exceção capturada na página]:', err.message);
    });

    // Passa sandboxUrl igual à origem web
    await pageC.goto('http://localhost:5173/?sandboxUrl=http://localhost:5173');

    // Aguarda badge .state-error
    await pageC.waitForSelector('.state-error', { timeout: 10000 });
    const errorStateText = await pageC.textContent('.state-error');

    // Verifica que o iframe do sandbox não foi montado
    const iframeCount = await pageC.locator('.sandbox-iframe').count();

    console.log(`  Estado do runtime: ${errorStateText}`);
    console.log(`  Iframes montados: ${iframeCount}`);

    const hasRefusal =
      (pageErrorCaught && pageErrorMessage.includes('Sandbox não pode rodar na mesma origem')) ||
      errorStateText?.trim().toLowerCase() === 'error';

    if (!hasRefusal || iframeCount !== 0) {
      throw new Error(`FALHA: Mesma origem não foi recusada adequadamente (hasRefusal=${hasRefusal}, iframes=${iframeCount})`);
    }

    console.log('✅ Cenário (c) APROVADO: Abertura na mesma origem foi recusada com runtimeState=error e exceção de segurança.');

    await browser.close();

    console.log('\n======================================================');
    console.log('🎉 TODOS OS TESTES DE SEGURANÇA S0 PASSARAM COM SUCESSO!');
    console.log('======================================================\n');
  } finally {
    cleanup();
    setTimeout(() => process.exit(0), 500);
  }
}

runSecurityTests().catch((err) => {
  console.error('❌ ERRO NO TESTE DE SEGURANÇA S0:', err);
  process.exit(1);
});
