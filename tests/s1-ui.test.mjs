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

async function runS1UITests() {
  console.log('🚀 [S1 UI Test] Iniciando servidores apps/sandbox (5174) e apps/web (5173)...');

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

    console.log('Navegando para http://localhost:5173...');
    await page.goto('http://localhost:5173', { timeout: 30000 });
    await page.waitForSelector('.state-ready', { timeout: 30000 });
    console.log('✅ UI conectada e runtime inicial pronto (.state-ready).');

    // -------------------------------------------------------------------------
    // Teste 1: Estado inicial JavaScript
    // -------------------------------------------------------------------------
    console.log('\n--- Teste 1: Validação do perfil inicial (JavaScript) ---');
    {
      const headerText = await page.textContent('.status-bar');
      console.log('  Header:', headerText?.trim());
      if (!headerText?.includes('Runtime JS:')) {
        throw new Error(`FALHA no Teste 1: Header não contém "Runtime JS:", obtido: ${headerText}`);
      }

      const entryFile = await page.textContent('.entry-file-label');
      console.log('  Entry file:', entryFile?.trim());
      if (entryFile?.trim() !== 'index.js') {
        throw new Error(`FALHA no Teste 1: Arquivo de entrada esperado "index.js", obtido: ${entryFile}`);
      }

      const initialCode = await page.inputValue('.code-textarea');
      if (!initialCode.includes('console.log("oi");')) {
        throw new Error(`FALHA no Teste 1: Código inicial esperado console.log("oi"), obtido: ${initialCode}`);
      }

      const presetButtons = await page.$$eval('.preset-btn', (els) => els.map((e) => e.textContent?.trim()));
      console.log('  Presets JS encontrados:', presetButtons.length, presetButtons);
      if (presetButtons.length !== 6 || !presetButtons[0].includes('console.log')) {
        throw new Error('FALHA no Teste 1: Presets específicos de JS não foram renderizados adequadamente.');
      }
      console.log('✅ Teste 1 APROVADO: Perfil JavaScript inicial validado.');
    }

    // -------------------------------------------------------------------------
    // Teste 2: Alternância para Python via select UI
    // -------------------------------------------------------------------------
    console.log('\n--- Teste 2: Alternância para Python via Select UI ---');
    {
      await page.selectOption('#select-language', 'python');
      await page.waitForSelector('.state-ready', { timeout: 30000 });

      const headerText = await page.textContent('.status-bar');
      console.log('  Header após switch Python:', headerText?.trim());
      if (!headerText?.includes('Runtime Python:')) {
        throw new Error(`FALHA no Teste 2: Header não atualizou para "Runtime Python:", obtido: ${headerText}`);
      }

      const entryFile = await page.textContent('.entry-file-label');
      console.log('  Entry file Python:', entryFile?.trim());
      if (entryFile?.trim() !== 'main.py') {
        throw new Error(`FALHA no Teste 2: Arquivo de entrada esperado "main.py", obtido: ${entryFile}`);
      }

      const pyInitialCode = await page.inputValue('.code-textarea');
      console.log('  Código inicial Python:', pyInitialCode.trim());
      if (!pyInitialCode.includes('print("oi")')) {
        throw new Error(`FALHA no Teste 2: Código inicial esperado print("oi"), obtido: ${pyInitialCode}`);
      }

      const presetButtons = await page.$$eval('.preset-btn', (els) => els.map((e) => e.textContent?.trim()));
      console.log('  Presets Python encontrados:', presetButtons.length, presetButtons);
      if (presetButtons.length !== 6 || !presetButtons[0].includes('print')) {
        throw new Error('FALHA no Teste 2: Presets específicos de Python não foram renderizados adequadamente.');
      }
      console.log('✅ Teste 2 APROVADO: Alternância para Python e presets adaptados validados.');
    }

    // -------------------------------------------------------------------------
    // Teste 3: Retenção de edição de texto em memória ao alternar linguagens
    // -------------------------------------------------------------------------
    console.log('\n--- Teste 3: Retenção do código editado pelo usuário na memória ---');
    {
      const customPythonCode = '# Custom Python Code\nmsg = "licode memory retention test"\nprint(msg)';
      await page.fill('.code-textarea', customPythonCode);

      console.log('  Digitado código customizado em Python. Alternando para JavaScript...');
      await page.selectOption('#select-language', 'javascript');

      const jsCode = await page.inputValue('.code-textarea');
      console.log('  Código ao voltar para JS:', jsCode.trim());
      if (!jsCode.includes('console.log("oi");')) {
        throw new Error('FALHA no Teste 3: Código do JavaScript foi sobrescrito indevidamente!');
      }

      console.log('  Alternando de volta para Python...');
      await page.selectOption('#select-language', 'python');

      const restoredPythonCode = await page.inputValue('.code-textarea');
      console.log('  Código restaurado em Python:', restoredPythonCode.trim());
      if (restoredPythonCode.trim() !== customPythonCode) {
        throw new Error('FALHA no Teste 3: Edição do usuário em Python não foi retida na memória!');
      }
      console.log('✅ Teste 3 APROVADO: Retenção em memória preservou perfeitamente as edições do usuário.');
    }

    // -------------------------------------------------------------------------
    // Teste 4: Perfil Ruby (Em breve) com botão desabilitado
    // -------------------------------------------------------------------------
    console.log('\n--- Teste 4: Validação do perfil Ruby (Em breve) ---');
    {
      await page.selectOption('#select-language', 'ruby');

      const headerText = await page.textContent('.status-bar');
      console.log('  Header Ruby:', headerText?.trim());
      if (!headerText?.includes('Runtime Ruby:')) {
        throw new Error(`FALHA no Teste 4: Header não atualizou para "Runtime Ruby:", obtido: ${headerText}`);
      }

      const entryFile = await page.textContent('.entry-file-label');
      console.log('  Entry file Ruby:', entryFile?.trim());
      if (entryFile?.trim() !== 'main.rb') {
        throw new Error(`FALHA no Teste 4: Arquivo de entrada esperado "main.rb", obtido: ${entryFile}`);
      }

      const isRunDisabled = await page.$eval('.btn-run', (btn) => btn.disabled);
      console.log('  Botão Run desabilitado para Ruby?:', isRunDisabled);
      if (!isRunDisabled) {
        throw new Error('FALHA no Teste 4: Botão Run deveria estar desabilitado para Ruby (runtimeReady=false)!');
      }
      console.log('✅ Teste 4 APROVADO: Perfil Ruby exibe main.rb e bloqueia execução adequadamente.');
    }

    // -------------------------------------------------------------------------
    // Teste 5: Execução real pela UI via profile.entryFile
    // -------------------------------------------------------------------------
    console.log('\n--- Teste 5: Execução de código Python via UI ---');
    {
      await page.selectOption('#select-language', 'python');
      await page.waitForSelector('.state-ready', { timeout: 30000 });

      // Seleciona o preset 1 de Python
      await page.click('.preset-btn >> text=1. print("oi")');
      await page.click('.btn-run');

      await page.waitForSelector('.status-badge', { timeout: 20000 });
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

      console.log('  Badge obtido:', badgeText?.trim());
      console.log('  Logs obtidos:', logs);

      const hasOi = logs.some((l) => l.channel === 'stdout' && l.text.includes('oi'));
      const isCode0 = badgeText?.includes('code 0');

      if (!hasOi || !isCode0) {
        throw new Error('FALHA no Teste 5: Execução de Python pela UI falhou!');
      }
      console.log('✅ Teste 5 APROVADO: Execução pela UI utilizou profile.entryFile (main.py) com sucesso.');
    }

    await browser.close();

    console.log('\n======================================================');
    console.log('🎉 TODOS OS TESTES DE UI S1 PASSARAM COM SUCESSO!');
    console.log('======================================================\n');
  } finally {
    cleanup();
    setTimeout(() => process.exit(0), 500);
  }
}

runS1UITests().catch((err) => {
  console.error('\n❌ ERRO NO TESTE DE UI S1:', err);
  process.exit(1);
});
