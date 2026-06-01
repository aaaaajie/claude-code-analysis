import { execFileSync } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await rm(resolve(root, 'dist', 'artifacts'), { recursive: true, force: true })
await rm(resolve(root, 'dist', 'update'), { recursive: true, force: true })

execFileSync(process.execPath, ['scripts/build-binary.mjs'], {
  cwd: root,
  stdio: 'inherit',
})

execFileSync(process.execPath, ['scripts/package-binary.mjs'], {
  cwd: root,
  stdio: 'inherit',
})
