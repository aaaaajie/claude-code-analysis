import { execFile } from 'node:child_process'
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import {
  basename,
  dirname,
  join,
  resolve,
  sep,
} from 'node:path'
import { promisify } from 'node:util'
import { getProjectRoot } from '../../bootstrap/state.js'
import { tryParseShellCommand } from '../bash/shellQuote.js'
import { parseFrontmatter } from '../frontmatterParser.js'
import { getClaudeConfigHomeDir } from '../envUtils.js'

const execFileAsync = promisify(execFile)

const SKILL_FILE = 'SKILL.md'
const MAX_SKILL_FILE_BYTES = 1024 * 1024
const MAX_INSTALL_BYTES = 50 * 1024 * 1024
const GITHUB_REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const SKILL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/
const DEFAULT_SKILLS_REPO = 'anthropics/skills'
const DEFAULT_SKILLS_BASE_PATH = 'skills'

export type SkillInstallScope = 'user' | 'project'

export type SkillInstallRequest = {
  sources: string[]
  scope: SkillInstallScope
  cwd?: string
  force?: boolean
  name?: string
  ref?: string
}

export type ParsedSkillInstallArgs = {
  sources: string[]
  scope: SkillInstallScope
  force: boolean
  name?: string
  ref?: string
}

export type InstalledSkill = {
  name: string
  source: string
  destination: string
  backup?: string
  fileCount: number
  totalBytes: number
}

export type SkillInstallResult = {
  scope: SkillInstallScope
  root: string
  installed: InstalledSkill[]
}

type PreparedSkill = {
  source: string
  sourceDir: string
  nameHint: string
}

type GithubSource = {
  owner: string
  repo: string
  ref: string
  path: string
  kind: 'tree' | 'blob'
}

export async function installSkills(
  request: SkillInstallRequest,
): Promise<SkillInstallResult> {
  if (request.sources.length === 0) {
    throw new Error(helpText())
  }
  if (request.name && request.sources.length !== 1) {
    throw new Error('--name 只能在安装单个 skill 时使用。')
  }
  if (request.name) {
    assertValidSkillName(request.name)
  }

  const root = getInstallRoot(request.scope, request.cwd)
  await mkdir(root, { recursive: true, mode: 0o700 })

  const installed: InstalledSkill[] = []
  const expandedSources = await expandGithubRepoSources(
    request.sources,
    request.ref,
    request.cwd,
  )
  for (const source of expandedSources) {
    const tempDirs: string[] = []
    try {
      const prepared = await prepareSource(
        source,
        request.name,
        tempDirs,
        request.cwd,
        request.ref,
      )
      for (const skill of prepared) {
        installed.push(
          await installPreparedSkill({
            skill,
            root,
            force: request.force ?? false,
            overrideName: request.name,
          }),
        )
      }
    } finally {
      await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })))
    }
  }

  return {
    scope: request.scope,
    root,
    installed,
  }
}

export function formatSkillInstallResult(result: SkillInstallResult): string {
  if (result.installed.length === 0) {
    return '没有安装任何 skill。'
  }
  const scopeLabel = result.scope === 'project' ? '项目' : '用户'
  const lines = [
    `已安装 ${result.installed.length} 个 ${scopeLabel} skill。`,
    `目录：${result.root}`,
    '',
  ]
  for (const item of result.installed) {
    lines.push(`- ${item.name} -> ${item.destination}`)
    if (item.backup) {
      lines.push(`  旧版本备份：${item.backup}`)
    }
  }
  return lines.join('\n')
}

export function helpText(): string {
  return [
    '用法：',
    '  /skill-install [--project|--user] [--force] [--name <name>] <source...>',
    '  /skill-install [--project|--user] [--force] [--ref <ref>] <owner/repo> <path...>',
    '',
    'source 支持：',
    '  - 本地 skill 目录或 SKILL.md 文件',
    '  - GitHub tree/blob URL',
    '  - raw.githubusercontent.com 的 SKILL.md URL',
    '  - owner/repo + repo 内 skill 路径',
    '  - 裸 skill 名称（默认从 anthropics/skills 的 skills/<name> 安装）',
    '',
    '可用 SECAI_SKILLS_REPO 和 SECAI_SKILLS_BASE_PATH 覆盖裸名称来源。',
    '默认安装到 ~/.secai/skills；加 --project 安装到当前项目 .secai/skills。',
  ].join('\n')
}

export function parseSkillInstallArgs(args: string): ParsedSkillInstallArgs {
  const parsed = tryParseShellCommand(args)
  if (!parsed.success) {
    throw new Error(`参数解析失败：${parsed.error}`)
  }
  const tokens = parsed.tokens.map(token => {
    if (typeof token !== 'string') {
      throw new Error('不支持 shell 控制符、变量或重定向参数。')
    }
    return token
  })

  let scope: SkillInstallScope = 'user'
  let force = false
  let name: string | undefined
  let ref: string | undefined
  const sources: string[] = []

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!
    if (token === '--help' || token === '-h' || token === 'help') {
      throw new Error(helpText())
    }
    if (token === '--project') {
      scope = 'project'
      continue
    }
    if (token === '--user') {
      scope = 'user'
      continue
    }
    if (token === '--force' || token === '-f') {
      force = true
      continue
    }
    if (token === '--name') {
      name = readOptionValue(tokens, ++i, '--name')
      continue
    }
    if (token.startsWith('--name=')) {
      name = token.slice('--name='.length)
      continue
    }
    if (token === '--ref') {
      ref = readOptionValue(tokens, ++i, '--ref')
      continue
    }
    if (token.startsWith('--ref=')) {
      ref = token.slice('--ref='.length)
      continue
    }
    if (token.startsWith('-')) {
      throw new Error(`未知参数：${token}\n\n${helpText()}`)
    }
    sources.push(token)
  }

  if (sources.length === 0) {
    throw new Error(helpText())
  }
  return { sources, scope, force, name, ref }
}

function getInstallRoot(scope: SkillInstallScope, cwd?: string): string {
  if (scope === 'project') {
    return join(cwd ?? getProjectRoot(), '.secai', 'skills')
  }
  return join(getClaudeConfigHomeDir(), 'skills')
}

async function expandGithubRepoSources(
  sources: string[],
  ref: string | undefined,
  cwd: string | undefined,
): Promise<string[]> {
  const [first, ...rest] = sources
  if (!first || !GITHUB_REPO_PATTERN.test(first) || rest.length === 0) {
    return sources
  }
  const localFirst = await stat(resolve(cwd ?? process.cwd(), first)).catch(
    () => null,
  )
  if (localFirst) {
    return sources
  }
  const normalizedRef = ref ?? 'main'
  return rest.map(path => `github:${first}:${normalizedRef}:${path}`)
}

async function resolveNamedSource(
  source: string,
  ref: string | undefined,
  cwd: string | undefined,
): Promise<string> {
  if (!SKILL_NAME_PATTERN.test(source)) {
    return source
  }
  const localSource = await stat(resolve(cwd ?? process.cwd(), source)).catch(
    () => null,
  )
  if (localSource) {
    return source
  }
  const repo = process.env.SECAI_SKILLS_REPO ?? DEFAULT_SKILLS_REPO
  const basePath = process.env.SECAI_SKILLS_BASE_PATH ?? DEFAULT_SKILLS_BASE_PATH
  if (!GITHUB_REPO_PATTERN.test(repo)) {
    throw new Error(`SECAI_SKILLS_REPO 无效：${repo}`)
  }
  return `github:${repo}:${ref ?? 'main'}:${basePath.replace(/\/$/, '')}/${source}`
}

async function prepareSource(
  source: string,
  nameOverride: string | undefined,
  tempDirs: string[],
  cwd: string | undefined,
  ref: string | undefined,
): Promise<PreparedSkill[]> {
  source = await resolveNamedSource(source, ref, cwd)
  if (source.startsWith('github:')) {
    return prepareGithubShorthand(source, tempDirs)
  }
  if (isHttpUrl(source)) {
    return prepareUrlSource(source, nameOverride, tempDirs)
  }
  return prepareLocalSource(source, cwd)
}

async function prepareGithubShorthand(
  source: string,
  tempDirs: string[],
): Promise<PreparedSkill[]> {
  const match = source.match(/^github:([^:]+\/[^:]+):([^:]+):(.+)$/)
  if (!match) {
    throw new Error(`无效 GitHub source：${source}`)
  }
  const [, repo, ref, path] = match
  const [owner, repoName] = repo!.split('/')
  return prepareGithubTree(
    {
      owner: owner!,
      repo: repoName!,
      ref: ref!,
      path: path!,
      kind: 'tree',
    },
    source,
    tempDirs,
  )
}

async function prepareUrlSource(
  source: string,
  nameOverride: string | undefined,
  tempDirs: string[],
): Promise<PreparedSkill[]> {
  const github = parseGithubUrl(source)
  if (github) {
    if (github.kind === 'blob' && basename(github.path).toLowerCase() === 'skill.md') {
      return prepareRawSkillUrl(githubRawUrl(github), source, nameOverride, tempDirs)
    }
    return prepareGithubTree(github, source, tempDirs)
  }

  const url = new URL(source)
  if (
    url.hostname === 'raw.githubusercontent.com' ||
    basename(url.pathname).toLowerCase() === 'skill.md'
  ) {
    return prepareRawSkillUrl(source, source, nameOverride, tempDirs)
  }
  throw new Error(`不支持的 URL source：${source}`)
}

async function prepareRawSkillUrl(
  url: string,
  originalSource: string,
  nameOverride: string | undefined,
  tempDirs: string[],
): Promise<PreparedSkill[]> {
  const content = await fetchSkillFile(url)
  const tmp = await mkdtemp(join(tmpdir(), 'secai-skill-'))
  tempDirs.push(tmp)
  const skillDir = join(tmp, nameOverride ?? skillNameHintFromUrl(originalSource))
  await mkdir(skillDir, { recursive: true, mode: 0o700 })
  await writeFile(join(skillDir, SKILL_FILE), content, { mode: 0o600 })
  return [
    {
      source: originalSource,
      sourceDir: skillDir,
      nameHint: nameOverride ?? skillNameHintFromUrl(originalSource),
    },
  ]
}

async function prepareGithubTree(
  github: GithubSource,
  originalSource: string,
  tempDirs: string[],
): Promise<PreparedSkill[]> {
  const tmp = await mkdtemp(join(tmpdir(), 'secai-skill-git-'))
  tempDirs.push(tmp)
  const repoDir = join(tmp, 'repo')
  await cloneGithubSparse(github, repoDir)
  const skillPath = resolve(repoDir, github.path)
  assertInside(repoDir, skillPath)
  return preparedSkillsFromDirectory(skillPath, originalSource)
}

async function prepareLocalSource(
  source: string,
  cwd: string | undefined,
): Promise<PreparedSkill[]> {
  const resolved = resolve(cwd ?? process.cwd(), source)
  const s = await stat(resolved).catch(() => null)
  if (!s) {
    throw new Error(`找不到 source：${source}`)
  }
  if (s.isFile()) {
    if (basename(resolved).toLowerCase() !== 'skill.md') {
      throw new Error(`文件 source 必须是 SKILL.md：${source}`)
    }
    return [
      {
        source,
        sourceDir: dirname(resolved),
        nameHint: basename(dirname(resolved)),
      },
    ]
  }
  if (!s.isDirectory()) {
    throw new Error(`source 不是文件或目录：${source}`)
  }
  return preparedSkillsFromDirectory(resolved, source)
}

async function preparedSkillsFromDirectory(
  dir: string,
  source: string,
): Promise<PreparedSkill[]> {
  const skillFile = join(dir, SKILL_FILE)
  const direct = await stat(skillFile).catch(() => null)
  if (direct?.isFile()) {
    return [{ source, sourceDir: dir, nameHint: basename(dir) }]
  }

  const entries = await readdir(dir, { withFileTypes: true })
  const skills: PreparedSkill[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const child = join(dir, entry.name)
    const childSkillFile = await stat(join(child, SKILL_FILE)).catch(() => null)
    if (childSkillFile?.isFile()) {
      skills.push({
        source: `${source}/${entry.name}`,
        sourceDir: child,
        nameHint: entry.name,
      })
    }
  }
  if (skills.length === 0) {
    throw new Error(`未找到 SKILL.md：${source}`)
  }
  return skills
}

async function installPreparedSkill({
  skill,
  root,
  force,
  overrideName,
}: {
  skill: PreparedSkill
  root: string
  force: boolean
  overrideName?: string
}): Promise<InstalledSkill> {
  const name = overrideName ?? (await getSkillName(skill.sourceDir, skill.nameHint))
  assertValidSkillName(name)

  const destination = resolve(root, name)
  assertInside(root, destination)
  const tempDestination = resolve(root, `.${name}.tmp-${process.pid}-${Date.now()}`)
  assertInside(root, tempDestination)

  try {
    const summary = await copySkillDirectory(skill.sourceDir, tempDestination)
    const existing = await stat(destination).catch(() => null)
    let backup: string | undefined
    if (existing) {
      if (!force) {
        throw new Error(`skill 已存在：${destination}。如需覆盖请加 --force。`)
      }
      backup = resolve(root, `.${name}.backup-${timestamp()}`)
      assertInside(root, backup)
      await rename(destination, backup)
    }
    await rename(tempDestination, destination)
    return {
      name,
      source: skill.source,
      destination,
      backup,
      ...summary,
    }
  } finally {
    await rm(tempDestination, { recursive: true, force: true })
  }
}

async function getSkillName(sourceDir: string, fallback: string): Promise<string> {
  const content = await readFile(join(sourceDir, SKILL_FILE), 'utf8')
  const parsed = parseFrontmatter(content, join(sourceDir, SKILL_FILE))
  const frontmatterName = parsed.frontmatter.name
  if (typeof frontmatterName === 'string' && frontmatterName.trim()) {
    return frontmatterName.trim()
  }
  return fallback
}

async function copySkillDirectory(
  sourceDir: string,
  destinationDir: string,
): Promise<{ fileCount: number; totalBytes: number }> {
  let fileCount = 0
  let totalBytes = 0

  async function copyDir(from: string, to: string): Promise<void> {
    await mkdir(to, { recursive: true, mode: 0o700 })
    const entries = await readdir(from, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === '.git') continue
      const sourcePath = join(from, entry.name)
      const targetPath = join(to, entry.name)
      const entryStat = await lstat(sourcePath)
      if (entryStat.isSymbolicLink()) {
        throw new Error(`拒绝安装包含符号链接的 skill：${sourcePath}`)
      }
      if (entryStat.isDirectory()) {
        await copyDir(sourcePath, targetPath)
        continue
      }
      if (!entryStat.isFile()) {
        continue
      }
      totalBytes += entryStat.size
      if (totalBytes > MAX_INSTALL_BYTES) {
        throw new Error(`skill 文件总大小超过限制：${MAX_INSTALL_BYTES} bytes`)
      }
      await copyFile(sourcePath, targetPath)
      fileCount += 1
    }
  }

  await copyDir(sourceDir, destinationDir)
  const skillStat = await stat(join(destinationDir, SKILL_FILE)).catch(() => null)
  if (!skillStat?.isFile()) {
    throw new Error(`安装后的目录缺少 ${SKILL_FILE}`)
  }
  return { fileCount, totalBytes }
}

async function fetchSkillFile(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/plain, text/markdown, */*',
        'User-Agent': 'SecAI-Skill-Installer',
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > MAX_SKILL_FILE_BYTES) {
      throw new Error(`SKILL.md 超过限制：${MAX_SKILL_FILE_BYTES} bytes`)
    }
    return text
  } finally {
    clearTimeout(timer)
  }
}

async function cloneGithubSparse(
  github: GithubSource,
  repoDir: string,
): Promise<void> {
  const repoUrl = `https://github.com/${github.owner}/${github.repo}.git`
  try {
    await execFileAsync('git', [
      'clone',
      '--depth=1',
      '--filter=blob:none',
      '--sparse',
      '--branch',
      github.ref,
      repoUrl,
      repoDir,
    ])
    await execFileAsync('git', ['-C', repoDir, 'sparse-checkout', 'set', github.path])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`GitHub skill 下载失败：${repoUrl}#${github.ref}:${github.path}\n${message}`)
  }
}

function parseGithubUrl(source: string): GithubSource | null {
  const url = new URL(source)
  if (url.hostname !== 'github.com') {
    return null
  }
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 5) {
    return null
  }
  const [owner, repo, kind, ref, ...pathParts] = parts
  if (!owner || !repo || (kind !== 'tree' && kind !== 'blob') || !ref) {
    return null
  }
  return {
    owner,
    repo: repo.replace(/\.git$/, ''),
    kind,
    ref,
    path: pathParts.join('/'),
  }
}

function githubRawUrl(github: GithubSource): string {
  return `https://raw.githubusercontent.com/${github.owner}/${github.repo}/${github.ref}/${github.path}`
}

function skillNameHintFromUrl(source: string): string {
  const url = new URL(source)
  const parts = url.pathname.split('/').filter(Boolean)
  const last = parts.at(-1)
  if (last?.toLowerCase() === 'skill.md') {
    return parts.at(-2) ?? 'skill'
  }
  return last ?? 'skill'
}

function assertValidSkillName(name: string): void {
  if (!SKILL_NAME_PATTERN.test(name)) {
    throw new Error(
      `无效 skill 名称：${name}。只能包含字母、数字、下划线和短横线，且必须以字母或数字开头。`,
    )
  }
}

function assertInside(root: string, target: string): void {
  const resolvedRoot = resolve(root)
  const resolvedTarget = resolve(target)
  if (
    resolvedTarget !== resolvedRoot &&
    !resolvedTarget.startsWith(resolvedRoot.endsWith(sep) ? resolvedRoot : resolvedRoot + sep)
  ) {
    throw new Error(`目标路径越界：${target}`)
  }
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('https://') || value.startsWith('http://')
}

function timestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')
}

function readOptionValue(tokens: string[], index: number, option: string): string {
  const value = tokens[index]
  if (!value || value.startsWith('-')) {
    throw new Error(`${option} 缺少参数值。`)
  }
  return value
}
