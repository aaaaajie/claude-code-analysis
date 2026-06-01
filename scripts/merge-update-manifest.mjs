import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const version = process.argv[2] || JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf8'),
).version
const updateRoot = join(root, 'dist', 'update', 'secai-cli')
const versionDir = join(updateRoot, version)

if (!existsSync(versionDir)) {
  throw new Error(`Missing update version directory: ${versionDir}`)
}

const platforms = {}
for (const file of readdirSync(versionDir)) {
  if (!file.startsWith('manifest.') || !file.endsWith('.json')) {
    continue
  }
  const fragment = JSON.parse(readFileSync(join(versionDir, file), 'utf8'))
  Object.assign(platforms, fragment.platforms || {})
}

if (Object.keys(platforms).length === 0) {
  throw new Error(`No manifest fragments found in ${versionDir}`)
}

writeFileSync(
  join(versionDir, 'manifest.json'),
  JSON.stringify({ version, platforms }, null, 2) + '\n',
  'utf8',
)
writeFileSync(join(updateRoot, 'latest'), `${version}\n`, 'utf8')
writeFileSync(join(updateRoot, 'stable'), `${version}\n`, 'utf8')

console.log(`Merged ${Object.keys(platforms).length} platforms into ${join(versionDir, 'manifest.json')}`)
