import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = join(root, 'src')

const macro = {
  VERSION: '1.0.9',
  BUILD_TIME: new Date().toISOString(),
  ISSUES_EXPLAINER: 'contact SecAI support',
  FEEDBACK_CHANNEL: 'SecAI support',
  PACKAGE_URL: 'secai-cli',
  NATIVE_PACKAGE_URL: 'secai-cli-native',
  VERSION_CHANGELOG: '',
}

const alias = {
  'bun:bundle': join(srcRoot, 'runtime/bunBundle.ts'),
  'bun:ffi': join(srcRoot, 'runtime/bunFfi.ts'),
  '@ant/claude-for-chrome-mcp': join(srcRoot, 'runtime/claudeInChromeStub.ts'),
  '@ant/computer-use-mcp': join(srcRoot, 'runtime/computerUseStub.ts'),
  '@ant/computer-use-mcp/sentinelApps': join(
    srcRoot,
    'runtime/computerUseStub.ts',
  ),
  '@ant/computer-use-mcp/types': join(srcRoot, 'runtime/computerUseStub.ts'),
  '@ant/computer-use-input': join(srcRoot, 'runtime/nativeStub.ts'),
  '@ant/computer-use-swift': join(srcRoot, 'runtime/nativeStub.ts'),
  'audio-capture-napi': join(srcRoot, 'runtime/nativeStub.ts'),
  'image-processor-napi': join(srcRoot, 'runtime/nativeStub.ts'),
  'url-handler-napi': join(srcRoot, 'runtime/nativeStub.ts'),
  'modifiers-napi': join(srcRoot, 'runtime/nativeStub.ts'),
  'color-diff-napi': join(srcRoot, 'native-ts/color-diff/index.ts'),
}

const missingModuleStub = join(srcRoot, 'runtime/missingModuleStub.cjs')
const emptyTextModule = join(srcRoot, 'runtime/emptyText.ts')

function resolveSourceImport(specifier, importer) {
  if (specifier.startsWith('src/')) {
    return join(root, specifier)
  }
  if (!specifier.startsWith('.')) {
    return null
  }
  return resolve(dirname(importer), specifier)
}

function candidateFiles(basePath) {
  if (extname(basePath)) {
    const without = basePath.replace(/\.(js|mjs|cjs)$/, '')
    return [
      basePath,
      `${without}.ts`,
      `${without}.tsx`,
      `${without}.mts`,
      `${without}.cts`,
      `${without}.js`,
      `${without}.jsx`,
    ]
  }

  return [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.mts`,
    `${basePath}.cts`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    join(basePath, 'index.ts'),
    join(basePath, 'index.tsx'),
    join(basePath, 'index.js'),
  ]
}

function resolveFile(basePath) {
  for (const candidate of candidateFiles(basePath)) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

const runtimePatchPlugin = {
  name: 'runtime-patches',
  setup(build) {
    build.onResolve({ filter: /.*/ }, args => {
      const target = alias[args.path]
      if (target) {
        return { path: target }
      }

      if (/\.(ans|md|txt|d\.ts)$/.test(args.path)) {
        const basePath = resolveSourceImport(args.path, args.importer || root)
        const file = basePath ? resolveFile(basePath) : null
        return { path: file ?? emptyTextModule }
      }

      const basePath = resolveSourceImport(args.path, args.importer || root)
      if (!basePath) {
        return undefined
      }

      const file = resolveFile(basePath)
      if (file) {
        return { path: file }
      }

      return { path: missingModuleStub }
    })

    build.onLoad({ filter: /\.[cm]?[tj]sx?$/ }, args => {
      let contents = readFileSync(args.path, 'utf8')
      contents = contents.replace(
        /\bfeature\(\s*(['"])[A-Z0-9_]+\1\s*\)/g,
        'false',
      )
      if (buildFormat === 'cjs') {
        contents = contents.replaceAll(
          'import.meta.url',
          'require("node:url").pathToFileURL(process.execPath).href',
        )
      }
      return {
        contents,
        loader: args.path.endsWith('.tsx') || args.path.endsWith('.jsx')
          ? 'tsx'
          : 'ts',
      }
    })

    build.onLoad({ filter: /\.(ans|md|txt|d\.ts)$/ }, args => {
      return {
        contents: existsSync(args.path) ? readFileSync(args.path, 'utf8') : '',
        loader: 'text',
      }
    })
  },
}

mkdirSync(join(root, 'dist'), { recursive: true })

const buildFormat = process.env.SECAI_BUILD_FORMAT === 'cjs' ? 'cjs' : 'esm'
const outfile =
  process.env.SECAI_BUILD_OUTFILE ||
  join(root, 'dist', buildFormat === 'cjs' ? 'claude.cjs' : 'claude.mjs')

await esbuild.build({
  entryPoints: [join(srcRoot, 'entrypoints/cli.tsx')],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: buildFormat,
  sourcemap: false,
  logLevel: 'info',
  minifySyntax: true,
  jsx: 'automatic',
  conditions: ['node', 'import', 'default'],
  mainFields: ['module', 'main'],
  plugins: [runtimePatchPlugin],
  banner: {
    js:
      buildFormat === 'esm'
        ? [
            '#!/usr/bin/env node',
            "import { createRequire as __createRequire } from 'node:module';",
            'const require = __createRequire(import.meta.url);',
          ].join('\n')
        : '#!/usr/bin/env node',
  },
  define: {
    MACRO: JSON.stringify(macro),
    'process.env.USER_TYPE': JSON.stringify('external'),
    'process.env.CLAUDE_CODE_VERIFY_PLAN': JSON.stringify('false'),
  },
  external: [
    'fsevents',
  ],
})
