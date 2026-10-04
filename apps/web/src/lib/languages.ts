export interface CodePreset {
  id: string;
  label: string;
  code: string;
}

export interface LanguageProfile {
  id: string;
  label: string;
  runtimeLabel: string;
  entryFile: string;
  runtimeReady: boolean;
  examples: CodePreset[];
}

export const LANGUAGES: LanguageProfile[] = [
  {
    id: 'javascript',
    label: 'JavaScript',
    runtimeLabel: 'Runtime JS',
    entryFile: 'index.js',
    runtimeReady: true,
    examples: [
      {
        id: 'hello',
        label: '1. console.log("oi")',
        code: 'console.log("oi");'
      },
      {
        id: 'timeout',
        label: '2. while(true) (Timeout 3s)',
        code: 'console.log("Iniciando loop infinito síncrono...");\nwhile (true) {\n  // bloqueia thread\n}'
      },
      {
        id: 'outputLimit',
        label: '3. Loop de Logs (Output Limit)',
        code: 'console.log("Iniciando spam de console.log...");\nlet i = 0;\nwhile (true) {\n  console.log("linha de log de teste #" + (++i) + " - flood flood flood");\n}'
      },
      {
        id: 'error',
        label: '4. Throw de Erro',
        code: 'console.log("Antes do throw");\nthrow new Error("Erro de execução simulado!");'
      },
      {
        id: 'security',
        label: '5. Isolamento (Escape Test)',
        code: 'console.log("Tentando acessar window/document/localStorage...");\ntry {\n  console.log("window:", typeof window !== "undefined" ? window : "INACESSÍVEL");\n} catch (e: any) { console.error("window bloqueado:", e.message); }\n\ntry {\n  console.log("document:", typeof document !== "undefined" ? document : "INACESSÍVEL");\n} catch (e: any) { console.error("document bloqueado:", e.message); }\n\ntry {\n  console.log("localStorage:", typeof localStorage !== "undefined" ? localStorage : "INACESSÍVEL");\n} catch (e: any) { console.error("localStorage bloqueado:", e.message); }'
      },
      {
        id: 'asyncInterval',
        label: '6. Stop Interrompe',
        code: 'console.log("Iniciando loop assíncrono. Clique em Stop para matar imediatamente!");\nlet count = 0;\nwhile (true) {\n  console.log("Tick #" + (++count));\n  await new Promise(r => setTimeout(r, 100));\n}'
      }
    ]
  },
  {
    id: 'python',
    label: 'Python',
    runtimeLabel: 'Runtime Python',
    entryFile: 'main.py',
    runtimeReady: true,
    examples: [
      {
        id: 'hello',
        label: '1. print("oi")',
        code: 'print("oi")'
      },
      {
        id: 'timeout',
        label: '2. while True (Timeout 3s)',
        code: 'print("Iniciando loop infinito síncrono...")\nwhile True:\n    pass'
      },
      {
        id: 'outputLimit',
        label: '3. Loop de Prints (Output Limit)',
        code: 'print("Iniciando spam de prints...")\ni = 0\nwhile True:\n    i += 1\n    print(f"linha de log de teste #{i} - flood flood flood")'
      },
      {
        id: 'error',
        label: '4. Raise de Erro (1/0)',
        code: 'print("Antes do erro")\n1 / 0'
      },
      {
        id: 'security',
        label: '5. Isolamento (Escape Test)',
        code: 'print("Tentando acessar js/window/document...")\ntry:\n    import js\n    w = getattr(js, "window", "INACESSÍVEL")\n    d = getattr(js, "document", "INACESSÍVEL")\n    print(f"window: {w}, document: {d}")\nexcept Exception as e:\n    print(f"js bloqueado: {e}")'
      },
      {
        id: 'asyncInterval',
        label: '6. Stop Interrompe',
        code: 'import time\nprint("Iniciando loop. Clique em Stop para matar imediatamente!")\ncount = 0\nwhile True:\n    count += 1\n    print(f"Tick #{count}")\n    time.sleep(0.1)'
      }
    ]
  },
  {
    id: 'ruby',
    label: 'Ruby (Em breve)',
    runtimeLabel: 'Runtime Ruby',
    entryFile: 'main.rb',
    runtimeReady: false,
    examples: [
      {
        id: 'hello',
        label: '1. puts "oi"',
        code: 'puts "oi"'
      },
      {
        id: 'timeout',
        label: '2. loop do (Timeout 3s)',
        code: 'puts "Iniciando loop infinito síncrono..."\nloop do\nend'
      },
      {
        id: 'outputLimit',
        label: '3. Loop de Prints (Output Limit)',
        code: 'puts "Iniciando spam..."\ni = 0\nloop do\n  i += 1\n  puts "linha de log de teste #{i} - flood flood flood"\nend'
      },
      {
        id: 'error',
        label: '4. Raise de Erro',
        code: 'puts "Antes do erro"\nraise "Erro de execução simulado!"'
      },
      {
        id: 'security',
        label: '5. Isolamento (Escape Test)',
        code: 'puts "Isolamento Ruby ativo"'
      },
      {
        id: 'asyncInterval',
        label: '6. Stop Interrompe',
        code: 'puts "Iniciando loop. Clique em Stop para matar imediatamente!"\ncount = 0\nloop do\n  count += 1\n  puts "Tick #{count}"\n  sleep 0.1\nend'
      }
    ]
  }
];

export const DEFAULT_LANGUAGE_ID = 'javascript';

export function getLanguageProfile(id: string): LanguageProfile {
  const found = LANGUAGES.find((l) => l.id === id);
  if (!found) {
    return LANGUAGES[0];
  }
  return found;
}
