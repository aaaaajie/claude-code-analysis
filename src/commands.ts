// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import addDir from './commands/add-dir/index.js'
import autofixPr from './commands/autofix-pr/index.js'
import backfillSessions from './commands/backfill-sessions/index.js'
import btw from './commands/btw/index.js'
import goodClaude from './commands/good-claude/index.js'
import issue from './commands/issue/index.js'
import feedback from './commands/feedback/index.js'
import clear from './commands/clear/index.js'
import color from './commands/color/index.js'
import commit from './commands/commit.js'
import copy from './commands/copy/index.js'
import commitPushPr from './commands/commit-push-pr.js'
import compact from './commands/compact/index.js'
import config from './commands/config/index.js'
import { context, contextNonInteractive } from './commands/context/index.js'
import cost from './commands/cost/index.js'
import diff from './commands/diff/index.js'
import ctx_viz from './commands/ctx_viz/index.js'
import memory from './commands/memory/index.js'
import help from './commands/help/index.js'
import init from './commands/init.js'
import initVerifiers from './commands/init-verifiers.js'
import keybindings from './commands/keybindings/index.js'
import logout from './commands/logout/index.js'
import breakCache from './commands/break-cache/index.js'
import mcp from './commands/mcp/index.js'
import onboarding from './commands/onboarding/index.js'
import recharge from './commands/recharge/index.js'
import rename from './commands/rename/index.js'
import resume from './commands/resume/index.js'
import review, { ultrareview } from './commands/review.js'
import secai from './commands/secai/index.js'
import share from './commands/share/index.js'
import skillInstall from './commands/skill-install/index.js'
import skills from './commands/skills/index.js'
import status from './commands/status/index.js'
import tasks from './commands/tasks/index.js'
import teleport from './commands/teleport/index.js'
/* eslint-disable @typescript-eslint/no-require-imports */
const agentsPlatform =
  process.env.USER_TYPE === 'ant'
    ? require('./commands/agents-platform/index.js').default
    : null
/* eslint-enable @typescript-eslint/no-require-imports */
import securityReview from './commands/security-review.js'
import bughunter from './commands/bughunter/index.js'
import terminalSetup from './commands/terminalSetup/index.js'
import usage from './commands/usage/index.js'
import theme from './commands/theme/index.js'
import vim from './commands/vim/index.js'
import { feature } from 'bun:bundle'
// Dead code elimination: conditional imports
/* eslint-disable @typescript-eslint/no-require-imports */
const proactive =
  feature('PROACTIVE') || feature('KAIROS')
    ? require('./commands/proactive.js').default
    : null
const briefCommand =
  feature('KAIROS') || feature('KAIROS_BRIEF')
    ? require('./commands/brief.js').default
    : null
const assistantCommand = feature('KAIROS')
  ? require('./commands/assistant/index.js').default
  : null
const voiceCommand = feature('VOICE_MODE')
  ? require('./commands/voice/index.js').default
  : null
const forceSnip = feature('HISTORY_SNIP')
  ? require('./commands/force-snip.js').default
  : null
const workflowsCmd = feature('WORKFLOW_SCRIPTS')
  ? (
      require('./commands/workflows/index.js') as typeof import('./commands/workflows/index.js')
    ).default
  : null
const clearSkillIndexCache = feature('EXPERIMENTAL_SKILL_SEARCH')
  ? (
      require('./services/skillSearch/localSearch.js') as typeof import('./services/skillSearch/localSearch.js')
    ).clearSkillIndexCache
  : null
const subscribePr = feature('KAIROS_GITHUB_WEBHOOKS')
  ? require('./commands/subscribe-pr.js').default
  : null
const ultraplan = feature('ULTRAPLAN')
  ? require('./commands/ultraplan.js').default
  : null
const torch = feature('TORCH') ? require('./commands/torch.js').default : null
const peersCmd = feature('UDS_INBOX')
  ? (
      require('./commands/peers/index.js') as typeof import('./commands/peers/index.js')
    ).default
  : null
const forkCmd = feature('FORK_SUBAGENT')
  ? (
      require('./commands/fork/index.js') as typeof import('./commands/fork/index.js')
    ).default
  : null
const buddy = feature('BUDDY')
  ? (
      require('./commands/buddy/index.js') as typeof import('./commands/buddy/index.js')
    ).default
  : null
/* eslint-enable @typescript-eslint/no-require-imports */
import permissions from './commands/permissions/index.js'
import plan from './commands/plan/index.js'
import fast from './commands/fast/index.js'
import passes from './commands/passes/index.js'
import hooks from './commands/hooks/index.js'
import files from './commands/files/index.js'
import branch from './commands/branch/index.js'
import agents from './commands/agents/index.js'
import plugin from './commands/plugin/index.js'
import reloadPlugins from './commands/reload-plugins/index.js'
import rewind from './commands/rewind/index.js'
import mockLimits from './commands/mock-limits/index.js'
import bridgeKick from './commands/bridge-kick.js'
import version from './commands/version.js'
import summary from './commands/summary/index.js'
import {
  resetLimits,
  resetLimitsNonInteractive,
} from './commands/reset-limits/index.js'
import antTrace from './commands/ant-trace/index.js'
import perfIssue from './commands/perf-issue/index.js'
import sandboxToggle from './commands/sandbox-toggle/index.js'
import chrome from './commands/chrome/index.js'
import { logError } from './utils/log.js'
import { toError } from './utils/errors.js'
import { logForDebugging } from './utils/debug.js'
import {
  getSkillDirCommands,
  clearSkillCaches,
  getDynamicSkills,
} from './skills/loadSkillsDir.js'
import { getBundledSkills } from './skills/bundledSkills.js'
import { getBuiltinPluginSkillCommands } from './plugins/builtinPlugins.js'
import {
  getPluginCommands,
  clearPluginCommandCache,
  getPluginSkills,
  clearPluginSkillsCache,
} from './utils/plugins/loadPluginCommands.js'
import memoize from 'lodash-es/memoize.js'
import { isUsing3PServices, isClaudeAISubscriber } from './utils/auth.js'
import { isFirstPartyAnthropicBaseUrl } from './utils/model/providers.js'
import env from './commands/env/index.js'
import exit from './commands/exit/index.js'
import exportCommand from './commands/export/index.js'
import model from './commands/model/index.js'
import tag from './commands/tag/index.js'
import outputStyle from './commands/output-style/index.js'
import upgrade from './commands/upgrade/index.js'
import statusline from './commands/statusline.js'
import effort from './commands/effort/index.js'
import stats from './commands/stats/index.js'
// insights.ts is 113KB (3200 lines, includes diffLines/html rendering). Lazy
// shim defers the heavy module until /insights is actually invoked.
const usageReport: Command = {
  type: 'prompt',
  name: 'insights',
  description: '生成会话分析报告',
  contentLength: 0,
  progressMessage: '正在分析会话',
  source: 'builtin',
  async getPromptForCommand(args, context) {
    const real = (await import('./commands/insights.js')).default
    if (real.type !== 'prompt') throw new Error('unreachable')
    return real.getPromptForCommand(args, context)
  },
}
import oauthRefresh from './commands/oauth-refresh/index.js'
import debugToolCall from './commands/debug-tool-call/index.js'
import { getSettingSourceName } from './utils/settings/constants.js'
import {
  type Command,
  getCommandName,
  isCommandEnabled,
} from './types/command.js'

// Re-export types from the centralized location
export type {
  Command,
  CommandBase,
  CommandResultDisplay,
  LocalCommandResult,
  LocalJSXCommandContext,
  PromptCommand,
  ResumeEntrypoint,
} from './types/command.js'
export { getCommandName, isCommandEnabled } from './types/command.js'

// Commands that get eliminated from the external build
export const INTERNAL_ONLY_COMMANDS = [
  backfillSessions,
  breakCache,
  bughunter,
  commit,
  commitPushPr,
  ctx_viz,
  goodClaude,
  issue,
  initVerifiers,
  ...(forceSnip ? [forceSnip] : []),
  mockLimits,
  bridgeKick,
  version,
  ...(ultraplan ? [ultraplan] : []),
  ...(subscribePr ? [subscribePr] : []),
  resetLimits,
  resetLimitsNonInteractive,
  onboarding,
  share,
  summary,
  teleport,
  antTrace,
  perfIssue,
  env,
  oauthRefresh,
  debugToolCall,
  agentsPlatform,
  autofixPr,
].filter(Boolean)

// Declared as a function so that we don't run this until getCommands is called,
// since underlying functions read from config, which can't be read at module initialization time
const COMMANDS = memoize((): Command[] => [
  addDir,
  agents,
  branch,
  btw,
  chrome,
  clear,
  color,
  compact,
  config,
  copy,
  context,
  contextNonInteractive,
  cost,
  diff,
  exit,
  fast,
  files,
  effort,
  help,
  init,
  keybindings,
  mcp,
  memory,
  model,
  outputStyle,
  plugin,
  recharge,
  reloadPlugins,
  rename,
  resume,
  skills,
  stats,
  status,
  statusline,
  tag,
  theme,
  feedback,
  review,
  secai,
  skillInstall,
  ultrareview,
  rewind,
  securityReview,
  terminalSetup,
  upgrade,
  usage,
  usageReport,
  vim,
  ...(forkCmd ? [forkCmd] : []),
  ...(buddy ? [buddy] : []),
  ...(proactive ? [proactive] : []),
  ...(briefCommand ? [briefCommand] : []),
  ...(assistantCommand ? [assistantCommand] : []),
  ...(voiceCommand ? [voiceCommand] : []),
  permissions,
  plan,
  hooks,
  exportCommand,
  sandboxToggle,
  ...(!isUsing3PServices() ? [logout] : []),
  passes,
  ...(peersCmd ? [peersCmd] : []),
  tasks,
  ...(workflowsCmd ? [workflowsCmd] : []),
  ...(torch ? [torch] : []),
  ...(process.env.USER_TYPE === 'ant' && !process.env.IS_DEMO
    ? INTERNAL_ONLY_COMMANDS
    : []),
])

export const builtInCommandNames = memoize(
  (): Set<string> =>
    new Set(COMMANDS().flatMap(_ => [_.name, ...(_.aliases ?? [])])),
)

async function getSkills(cwd: string): Promise<{
  skillDirCommands: Command[]
  pluginSkills: Command[]
  bundledSkills: Command[]
  builtinPluginSkills: Command[]
}> {
  try {
    const [skillDirCommands, pluginSkills] = await Promise.all([
      getSkillDirCommands(cwd).catch(err => {
        logError(toError(err))
        logForDebugging(
          'Skill directory commands failed to load, continuing without them',
        )
        return []
      }),
      getPluginSkills().catch(err => {
        logError(toError(err))
        logForDebugging('Plugin skills failed to load, continuing without them')
        return []
      }),
    ])
    // Bundled skills are registered synchronously at startup
    const bundledSkills = getBundledSkills()
    // Built-in plugin skills come from enabled built-in plugins
    const builtinPluginSkills = getBuiltinPluginSkillCommands()
    logForDebugging(
      `getSkills returning: ${skillDirCommands.length} skill dir commands, ${pluginSkills.length} plugin skills, ${bundledSkills.length} bundled skills, ${builtinPluginSkills.length} builtin plugin skills`,
    )
    return {
      skillDirCommands,
      pluginSkills,
      bundledSkills,
      builtinPluginSkills,
    }
  } catch (err) {
    // This should never happen since we catch at the Promise level, but defensive
    logError(toError(err))
    logForDebugging('Unexpected error in getSkills, returning empty')
    return {
      skillDirCommands: [],
      pluginSkills: [],
      bundledSkills: [],
      builtinPluginSkills: [],
    }
  }
}

/* eslint-disable @typescript-eslint/no-require-imports */
const getWorkflowCommands = feature('WORKFLOW_SCRIPTS')
  ? (
      require('./tools/WorkflowTool/createWorkflowCommand.js') as typeof import('./tools/WorkflowTool/createWorkflowCommand.js')
    ).getWorkflowCommands
  : null
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * Filters commands by their declared `availability` (auth/provider requirement).
 * Commands without `availability` are treated as universal.
 * This runs before `isEnabled()` so that provider-gated commands are hidden
 * regardless of feature-flag state.
 *
 * Not memoized — auth state can change mid-session (e.g. after /login),
 * so this must be re-evaluated on every getCommands() call.
 */
export function meetsAvailabilityRequirement(cmd: Command): boolean {
  if (!cmd.availability) return true
  for (const a of cmd.availability) {
    switch (a) {
      case 'claude-ai':
        if (isClaudeAISubscriber()) return true
        break
      case 'console':
        // Console API key user = direct 1P API customer (not 3P, not claude.ai).
        // Excludes 3P (Bedrock/Vertex/Foundry) who don't set ANTHROPIC_BASE_URL
        // and gateway users who proxy through a custom base URL.
        if (
          !isClaudeAISubscriber() &&
          !isUsing3PServices() &&
          isFirstPartyAnthropicBaseUrl()
        )
          return true
        break
      default: {
        const _exhaustive: never = a
        void _exhaustive
        break
      }
    }
  }
  return false
}

/**
 * Loads all command sources (skills, plugins, workflows). Memoized by cwd
 * because loading is expensive (disk I/O, dynamic imports).
 */
const loadAllCommands = memoize(async (cwd: string): Promise<Command[]> => {
  const [
    { skillDirCommands, pluginSkills, bundledSkills, builtinPluginSkills },
    pluginCommands,
    workflowCommands,
  ] = await Promise.all([
    getSkills(cwd),
    getPluginCommands(),
    getWorkflowCommands ? getWorkflowCommands(cwd) : Promise.resolve([]),
  ])

  return [
    ...bundledSkills,
    ...builtinPluginSkills,
    ...skillDirCommands,
    ...workflowCommands,
    ...pluginCommands,
    ...pluginSkills,
    ...COMMANDS(),
  ]
})

/**
 * Returns commands available to the current user. The expensive loading is
 * memoized, but availability and isEnabled checks run fresh every call so
 * auth changes (e.g. /login) take effect immediately.
 */
export async function getCommands(cwd: string): Promise<Command[]> {
  const allCommands = await loadAllCommands(cwd)

  // Get dynamic skills discovered during file operations
  const dynamicSkills = getDynamicSkills()

  // Build base commands without dynamic skills
  const baseCommands = allCommands.filter(
    _ => meetsAvailabilityRequirement(_) && isCommandEnabled(_),
  )

  if (dynamicSkills.length === 0) {
    return baseCommands
  }

  // Dedupe dynamic skills - only add if not already present
  const baseCommandNames = new Set(baseCommands.map(c => c.name))
  const uniqueDynamicSkills = dynamicSkills.filter(
    s =>
      !baseCommandNames.has(s.name) &&
      meetsAvailabilityRequirement(s) &&
      isCommandEnabled(s),
  )

  if (uniqueDynamicSkills.length === 0) {
    return baseCommands
  }

  // Insert dynamic skills after plugin skills but before built-in commands
  const builtInNames = new Set(COMMANDS().map(c => c.name))
  const insertIndex = baseCommands.findIndex(c => builtInNames.has(c.name))

  if (insertIndex === -1) {
    return [...baseCommands, ...uniqueDynamicSkills]
  }

  return [
    ...baseCommands.slice(0, insertIndex),
    ...uniqueDynamicSkills,
    ...baseCommands.slice(insertIndex),
  ]
}

/**
 * Clears only the memoization caches for commands, WITHOUT clearing skill caches.
 * Use this when dynamic skills are added to invalidate cached command lists.
 */
export function clearCommandMemoizationCaches(): void {
  loadAllCommands.cache?.clear?.()
  getSkillToolCommands.cache?.clear?.()
  getSlashCommandToolSkills.cache?.clear?.()
  // getSkillIndex in skillSearch/localSearch.ts is a separate memoization layer
  // built ON TOP of getSkillToolCommands/getCommands. Clearing only the inner
  // caches is a no-op for the outer — lodash memoize returns the cached result
  // without ever reaching the cleared inners. Must clear it explicitly.
  clearSkillIndexCache?.()
}

export function clearCommandsCache(): void {
  clearCommandMemoizationCaches()
  clearPluginCommandCache()
  clearPluginSkillsCache()
  clearSkillCaches()
}

/**
 * Filter AppState.mcp.commands to MCP-provided skills (prompt-type,
 * model-invocable, loaded from MCP). These live outside getCommands() so
 * callers that need MCP skills in their skill index thread them through
 * separately.
 */
export function getMcpSkillCommands(
  mcpCommands: readonly Command[],
): readonly Command[] {
  if (feature('MCP_SKILLS')) {
    return mcpCommands.filter(
      cmd =>
        cmd.type === 'prompt' &&
        cmd.loadedFrom === 'mcp' &&
        !cmd.disableModelInvocation,
    )
  }
  return []
}

// SkillTool shows ALL prompt-based commands that the model can invoke
// This includes both skills (from /skills/) and commands (from /commands/)
export const getSkillToolCommands = memoize(
  async (cwd: string): Promise<Command[]> => {
    const allCommands = await getCommands(cwd)
    return allCommands.filter(
      cmd =>
        cmd.type === 'prompt' &&
        !cmd.disableModelInvocation &&
        cmd.source !== 'builtin' &&
        // Always include skills from /skills/ dirs, bundled skills, and legacy /commands/ entries
        // (they all get an auto-derived description from the first line if frontmatter is missing).
        // Plugin/MCP commands still require an explicit description to appear in the listing.
        (cmd.loadedFrom === 'bundled' ||
          cmd.loadedFrom === 'skills' ||
          cmd.loadedFrom === 'commands_DEPRECATED' ||
          cmd.hasUserSpecifiedDescription ||
          cmd.whenToUse),
    )
  },
)

// Filters commands to include only skills. Skills are commands that provide
// specialized capabilities for the model to use. They are identified by
// loadedFrom being 'skills', 'plugin', or 'bundled', or having disableModelInvocation set.
export const getSlashCommandToolSkills = memoize(
  async (cwd: string): Promise<Command[]> => {
    try {
      const allCommands = await getCommands(cwd)
      return allCommands.filter(
        cmd =>
          cmd.type === 'prompt' &&
          cmd.source !== 'builtin' &&
          (cmd.hasUserSpecifiedDescription || cmd.whenToUse) &&
          (cmd.loadedFrom === 'skills' ||
            cmd.loadedFrom === 'plugin' ||
            cmd.loadedFrom === 'bundled' ||
            cmd.disableModelInvocation),
      )
    } catch (error) {
      logError(toError(error))
      // Return empty array rather than throwing - skills are non-critical
      // This prevents skill loading failures from breaking the entire system
      logForDebugging('Returning empty skills array due to load failure')
      return []
    }
  },
)

/**
 * Commands that are safe to use in remote mode (--remote).
 * These only affect local TUI state and don't depend on local filesystem,
 * git, shell, IDE, MCP, or other local execution context.
 *
 * Used in two places:
 * 1. Pre-filtering commands in main.tsx before REPL renders (prevents race with CCR init)
 * 2. Preserving local-only commands in REPL's handleRemoteInit after CCR filters
 */
export const REMOTE_SAFE_COMMANDS: Set<Command> = new Set([
  exit, // Exit the TUI
  clear, // Clear screen
  help, // Show help
  theme, // Change terminal theme
  color, // Change agent color
  vim, // Toggle vim mode
  cost, // Show session cost (local cost tracking)
  usage, // Show usage info
  copy, // Copy last message
  btw, // Quick note
  feedback, // Send feedback
  plan, // Plan mode toggle
  keybindings, // Keybinding management
  statusline, // Status line toggle
])

/**
 * Builtin commands of type 'local' that ARE safe to execute when received
 * over the Remote Control bridge. These produce text output that streams
 * back to the mobile/web client and have no terminal-only side effects.
 *
 * 'local-jsx' commands are blocked by type (they render Ink UI) and
 * 'prompt' commands are allowed by type (they expand to text sent to the
 * model) — this set only gates 'local' commands.
 *
 * When adding a new 'local' command that should work from mobile, add it
 * here. Default is blocked.
 */
export const BRIDGE_SAFE_COMMANDS: Set<Command> = new Set(
  [
    compact, // Shrink context — useful mid-session from a phone
    clear, // Wipe transcript
    cost, // Show session cost
    summary, // Summarize conversation
    files, // List tracked files
  ].filter((c): c is Command => c !== null),
)

/**
 * Whether a slash command is safe to execute when its input arrived over the
 * Remote Control bridge (mobile/web client).
 *
 * PR #19134 blanket-blocked all slash commands from bridge inbound because
 * `/model` from iOS was popping the local Ink picker. This predicate relaxes
 * that with an explicit allowlist: 'prompt' commands (skills) expand to text
 * and are safe by construction; 'local' commands need an explicit opt-in via
 * BRIDGE_SAFE_COMMANDS; 'local-jsx' commands render Ink UI and stay blocked.
 */
export function isBridgeSafeCommand(cmd: Command): boolean {
  if (cmd.type === 'local-jsx') return false
  if (cmd.type === 'prompt') return true
  return BRIDGE_SAFE_COMMANDS.has(cmd)
}

/**
 * Filter commands to only include those safe for remote mode.
 * Used to pre-filter commands when rendering the REPL in --remote mode,
 * preventing local-only commands from being briefly available before
 * the CCR init message arrives.
 */
export function filterCommandsForRemoteMode(commands: Command[]): Command[] {
  return commands.filter(cmd => REMOTE_SAFE_COMMANDS.has(cmd))
}

export function findCommand(
  commandName: string,
  commands: Command[],
): Command | undefined {
  return commands.find(
    _ =>
      _.name === commandName ||
      getCommandName(_) === commandName ||
      _.aliases?.includes(commandName),
  )
}

export function hasCommand(commandName: string, commands: Command[]): boolean {
  return findCommand(commandName, commands) !== undefined
}

export function getCommand(commandName: string, commands: Command[]): Command {
  const command = findCommand(commandName, commands)
  if (!command) {
    throw ReferenceError(
      `Command ${commandName} not found. Available commands: ${commands
        .map(_ => {
          const name = getCommandName(_)
          return _.aliases ? `${name} (aliases: ${_.aliases.join(', ')})` : name
        })
        .sort((a, b) => a.localeCompare(b))
        .join(', ')}`,
    )
  }

  return command
}

const USER_FACING_COMMAND_DESCRIPTIONS: Record<string, string> = {
  'Generate a report analyzing your Claude Code sessions':
    '生成会话分析报告',
  'Commit, push, and open a PR': '提交、推送并创建 PR',
  'Open or create your keybindings configuration file':
    '打开或创建快捷键配置文件',
  'Show help and available commands': '显示帮助和可用命令',
  'Exit the REPL': '退出交互会话',
  'Show your Claude Code usage statistics and activity':
    '显示 SecAI 使用统计和活动',
  'Manage allow & deny tool permission rules':
    '管理工具允许和拒绝权限规则',
  'Edit Claude memory files': '编辑 SecAI 记忆文件',
  'Create a branch of the current conversation at this point':
    '从当前位置创建当前对话分支',
  'List all files currently in context': '列出当前上下文中的所有文件',
  'Export the current conversation to a file or clipboard':
    '导出当前对话到文件或剪贴板',
  'Set up Claude GitHub Actions for a repository':
    '为仓库设置 GitHub Actions',
  'Upgrade to Max for higher rate limits and more Opus':
    '升级到 Max 以获得更高限额和更多 Opus',
  'List and manage background tasks': '列出并管理后台任务',
  'Visualize current context usage as a colored grid':
    '以彩色网格显示上下文使用情况',
  'Show current context usage': '显示当前上下文使用情况',
  'Toggle a searchable tag on the current session':
    '切换当前会话的可搜索标签',
  'Toggle between Vim and Normal editing modes':
    '在 Vim 和普通编辑模式间切换',
  'Claude in Chrome (Beta) settings': 'Chrome 集成（Beta）设置',
  'Manage MCP servers': '管理 MCP 服务器',
  'Set effort level for model usage': '设置模型推理强度',
  "Set up Claude Code's status line UI": '设置 SecAI 状态栏界面',
  'List available skills': '列出可用技能',
  'Install SecAI skills from local paths or GitHub sources':
    '从本地路径或 GitHub 安装 SecAI 技能',
  'Enable plan mode or view the current session plan':
    '启用计划模式或查看当前会话计划',
  'Install Claude Code native build': '安装 SecAI 原生版本',
  'Rename the current conversation': '重命名当前对话',
  'Open config panel': '打开配置面板',
  'Add a new working directory': '添加新的工作目录',
  'Show plan usage limits': '显示套餐使用限额',
  'Resume a previous conversation': '恢复之前的对话',
  'Sign out from your Anthropic account': '退出当前账号',
  'View hook configurations for tool events': '查看工具事件的 Hook 配置',
  'Show the total cost and duration of the current session':
    '显示当前会话总成本和耗时',
  'Set the prompt bar color for this session': '设置本会话提示栏颜色',
  'View uncommitted changes and per-turn diffs':
    '查看未提交改动和每轮差异',
  'Manage Claude Code plugins': '管理 SecAI 插件',
  'Manage agent configurations': '管理智能体配置',
  'Deprecated: use /config to change output style':
    '已废弃：使用 /config 更改输出风格',
  'Toggle brief-only mode': '切换精简模式',
  'Create a git commit': '创建 Git 提交',
  'Toggle voice mode': '切换语音模式',
  'Clear conversation history and free up context':
    '清空对话历史并释放上下文',
  'Change the theme': '更改主题',
  'Review a pull request': '审查 PR',
  'Activate pending plugin changes in the current session':
    '激活当前会话中待处理的插件更改',
  'Manage SecAI login, registration, balance, usage, and model routing':
    '管理 SecAI 登录、注册、余额、用量和模型',
}

const USER_FACING_COMMAND_NAME_DESCRIPTIONS: Record<string, string> = {
  agents: '管理智能体配置',
  'add-dir': '添加新的工作目录',
  branch: '从当前位置创建当前对话分支',
  brief: '切换精简模式',
  btw: '快速提一个旁路问题，不打断当前主对话',
  chrome: 'Chrome 集成设置',
  clear: '清空对话历史并释放上下文',
  color: '设置本会话提示栏颜色',
  commit: '创建 Git 提交',
  'commit-push-pr': '提交、推送并创建 PR',
  compact: '压缩当前对话',
  config: '打开配置面板',
  context: '显示当前上下文使用情况',
  copy: '复制 SecAI 最近一次回复到剪贴板，可用 /copy N 复制第 N 条最近回复',
  cost: '显示当前会话总成本和耗时',
  diff: '查看未提交改动和每轮差异',
  effort: '设置模型推理强度',
  exit: '退出交互会话',
  export: '导出当前对话到文件或剪贴板',
  fast: '切换快速模式',
  files: '列出当前上下文中的所有文件',
  help: '显示帮助和可用命令',
  hooks: '查看工具事件的 Hook 配置',
  ide: '管理 IDE 集成并显示状态',
  init: '初始化项目说明文件',
  keybindings: '打开或创建快捷键配置文件',
  login: '登录当前账号',
  logout: '退出当前账号',
  mcp: '管理 MCP 服务器',
  memory: '编辑 SecAI 记忆文件',
  model: '设置 AI 模型',
  'output-style': '更改输出风格',
  permissions: '管理工具权限规则',
  plan: '启用计划模式或查看当前会话计划',
  plugin: '管理 SecAI 插件',
  'reload-plugins': '激活当前会话中待处理的插件更改',
  rename: '重命名当前对话',
  resume: '恢复之前的对话',
  review: '审查 PR',
  sandbox: '切换沙箱设置',
  secai: '管理 SecAI',
  recharge: '查看 SecAI 充值方式和联系方式',
  'skill-install': '安装 SecAI 技能',
  skills: '列出可用技能',
  stats: '显示 SecAI 使用统计和活动',
  status: '显示版本、模型、账号、API 连接和工具状态',
  statusline: '设置 SecAI 状态栏界面',
  tag: '切换当前会话的可搜索标签',
  tasks: '列出并管理后台任务',
  todos: '显示当前任务列表',
  theme: '更改主题',
  usage: '显示套餐使用限额',
  vim: '在 Vim 和普通编辑模式间切换',
  voice: '切换语音模式',
}

const SETTING_SOURCE_LABELS: Record<string, string> = {
  user: '用户',
  project: '项目',
  'project, gitignored': '项目本地',
  'cli flag': '命令行参数',
  managed: '托管',
}

function localizeCommandDescription(cmd: Command): string {
  const translated = USER_FACING_COMMAND_DESCRIPTIONS[cmd.description]
  if (translated) {
    return translated
  }

  const commandName = getCommandName(cmd)
  if (commandName === 'model') {
    const current = cmd.description.match(/\(currently (.*)\)$/)?.[1]
    return current ? `设置 AI 模型（当前 ${current}）` : '设置 AI 模型'
  }
  if (commandName === 'fast') {
    const model = cmd.description.match(/\((.*) only\)$/)?.[1]
    return model ? `切换快速模式（仅 ${model}）` : '切换快速模式'
  }
  if (commandName === 'status') {
    return '显示版本、模型、账号、API 连接和工具状态'
  }

  const translatedByName = USER_FACING_COMMAND_NAME_DESCRIPTIONS[commandName]
  if (translatedByName) {
    return translatedByName
  }

  return cmd.description
    .replace(/\bClaude Code\b/g, 'SecAI')
    .replace(/\bClaude\b/g, 'SecAI')
    .replace(/\bAnthropic\b/g, '当前')
}

/**
 * Formats a command's description with its source annotation for user-facing UI.
 * Use this in typeahead, help screens, and other places where users need to see
 * where a command comes from.
 *
 * For model-facing prompts (like SkillTool), use cmd.description directly.
 */
export function formatDescriptionWithSource(cmd: Command): string {
  const description = localizeCommandDescription(cmd)

  if (cmd.type !== 'prompt') {
    return description
  }

  if (cmd.kind === 'workflow') {
    return `${description}（工作流）`
  }

  if (cmd.source === 'plugin') {
    const pluginName = cmd.pluginInfo?.pluginManifest.name
    if (pluginName) {
      return `（${pluginName}）${description}`
    }
    return `${description}（插件）`
  }

  if (cmd.source === 'builtin' || cmd.source === 'mcp') {
    return description
  }

  if (cmd.source === 'bundled') {
    return `${description}（内置）`
  }

  const sourceName = getSettingSourceName(cmd.source)
  const sourceLabel = SETTING_SOURCE_LABELS[sourceName] ?? sourceName
  return `${description}（${sourceLabel}）`
}
