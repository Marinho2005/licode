import { copyFile, mkdir, readFile, access } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

async function fileExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function copyAsset(src, dest) {
  await mkdir(dirname(dest), { recursive: true })
  await copyFile(src, dest)
  const { size } = await readFile(dest)
  console.log(`${dest} (${size} bytes)`)
}

async function main() {
  const pyodidePkg = join(repoRoot, 'node_modules/pyodide/package.json')
  const rubyPkg = join(repoRoot, 'node_modules/@ruby/3.4-wasm-wasi/package.json')

  if (!(await fileExists(pyodidePkg))) {
    console.error(`ERROR: Missing ${pyodidePkg}`)
    process.exit(1)
  }
  if (!(await fileExists(rubyPkg))) {
    console.error(`ERROR: Missing ${rubyPkg}`)
    process.exit(1)
  }

  const pyodidePkgJson = JSON.parse(await readFile(pyodidePkg, 'utf8'))
  const rubyPkgJson = JSON.parse(await readFile(rubyPkg, 'utf8'))

  const pyodideVersion = pyodidePkgJson.version
  const rubyVersion = rubyPkgJson.version

  const pyodideSrcDir = join(repoRoot, 'node_modules/pyodide')
  const rubySrcDir = join(repoRoot, 'node_modules/@ruby/3.4-wasm-wasi/dist')

  const pyodideDestDir = join(repoRoot, 'apps/sandbox/public/assets/pyodide', pyodideVersion)
  const rubyDestDir = join(repoRoot, 'apps/sandbox/public/assets/ruby', rubyVersion)

  const pyodideFiles = [
    'pyodide.asm.wasm',
    'pyodide.asm.mjs',
    'python_stdlib.zip',
    'pyodide-lock.json',
    'pyodide.mjs'
  ]

  for (const f of pyodideFiles) {
    const src = join(pyodideSrcDir, f)
    const dest = join(pyodideDestDir, f)
    if (!(await fileExists(src))) {
      console.error(`ERROR: Missing source file ${src}`)
      process.exit(1)
    }
    await copyAsset(src, dest)
  }

  const rubyFile = 'ruby+stdlib.wasm'
  const rubySrc = join(rubySrcDir, rubyFile)
  const rubyDest = join(rubyDestDir, rubyFile)
  if (!(await fileExists(rubySrc))) {
    console.error(`ERROR: Missing source file ${rubySrc}`)
    process.exit(1)
  }
  await copyAsset(rubySrc, rubyDest)

  console.log('Assets copied successfully')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
