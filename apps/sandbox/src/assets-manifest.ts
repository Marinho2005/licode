export const ASSET_MANIFEST: Record<
  'python' | 'ruby',
  { version: string; baseUrl: string; files: string[] }
> = {
  python: {
    version: '314.0.7',
    baseUrl: '/assets/pyodide/314.0.7/',
    files: [
      'pyodide.asm.wasm',
      'pyodide.asm.mjs',
      'python_stdlib.zip',
      'pyodide-lock.json',
      'pyodide.mjs'
    ]
  },
  ruby: {
    version: '2.10.1',
    baseUrl: '/assets/ruby/2.10.1/',
    files: []
  }
};
