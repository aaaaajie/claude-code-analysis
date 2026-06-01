import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { chmod, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const seaDir = join(root, 'dist', 'sea')
const binaryName = process.platform === 'win32' ? 'secai.exe' : 'secai'
const binaryPath = join(root, 'dist', binaryName)
const bundlePath = join(seaDir, 'secai.cjs')
const seaConfigPath = join(seaDir, 'sea-config.json')
const seaBlobPath = join(seaDir, 'sea-prep.blob')
const fuse = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'

await rm(seaDir, { recursive: true, force: true })
mkdirSync(seaDir, { recursive: true })

execFileSync(process.execPath, ['scripts/build-cli.mjs'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    SECAI_BUILD_FORMAT: 'cjs',
    SECAI_BUILD_OUTFILE: bundlePath,
  },
})

writeFileSync(
  seaConfigPath,
  JSON.stringify(
    {
      main: 'secai.cjs',
      output: 'sea-prep.blob',
      disableExperimentalSEAWarning: true,
    },
    null,
    2,
  ) + '\n',
)

execFileSync(process.execPath, ['--experimental-sea-config', seaConfigPath], {
  cwd: seaDir,
  stdio: 'inherit',
})

copyFileSync(process.execPath, binaryPath)
await chmod(binaryPath, 0o755)
await chmod(binaryPath, 0o755 | 0o200)

if (process.platform === 'darwin') {
  try {
    execFileSync('codesign', ['--remove-signature', binaryPath], {
      stdio: 'ignore',
    })
  } catch {
    // Unsigned Node builds do not need signature removal.
  }
}

const postject = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const postjectArgs = [
  '--no-install',
  'postject',
  binaryPath,
  'NODE_SEA_BLOB',
  seaBlobPath,
  '--sentinel-fuse',
  fuse,
]

if (process.platform === 'darwin') {
  postjectArgs.push('--macho-segment-name', 'NODE_SEA')
}

execFileSync(postject, postjectArgs, {
  cwd: root,
  stdio: 'inherit',
})

if (process.platform === 'darwin') {
  execFileSync('codesign', ['--sign', '-', binaryPath], {
    stdio: 'inherit',
  })
}

if (!existsSync(binaryPath)) {
  throw new Error(`Binary was not created: ${binaryPath}`)
}

execFileSync(binaryPath, ['--version'], { stdio: 'inherit' })
if (process.env.SECAI_SKIP_BINARY_SMOKE === '1') {
  console.log('Skipped prompt smoke test.')
} else {
  execFileSync(
    binaryPath,
    ['-p', '只回复两个字：成功', '--max-turns', '1', '--output-format', 'text'],
    { stdio: 'inherit' },
  )
}

console.log(`\nCreated ${binaryPath}`)
