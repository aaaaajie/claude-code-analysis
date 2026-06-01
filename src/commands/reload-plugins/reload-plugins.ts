import { feature } from 'bun:bundle'
import { getIsRemoteMode } from '../../bootstrap/state.js'
import { redownloadUserSettings } from '../../services/settingsSync/index.js'
import type { LocalCommandCall } from '../../types/command.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { refreshActivePlugins } from '../../utils/plugins/refresh.js'
import { settingsChangeDetector } from '../../utils/settings/changeDetector.js'

export const call: LocalCommandCall = async (_args, context) => {
  // CCR: re-pull user settings before the cache sweep so enabledPlugins /
  // extraKnownMarketplaces pushed from the user's local CLI (settingsSync)
  // take effect. Non-CCR headless (e.g. vscode SDK subprocess) shares disk
  // with whoever writes settings — the file watcher delivers changes, no
  // re-pull needed there.
  //
  // Managed settings intentionally NOT re-fetched: it already polls hourly
  // (POLLING_INTERVAL_MS), and policy enforcement is eventually-consistent
  // by design (stale-cache fallback on fetch failure). Interactive
  // /reload-plugins has never re-fetched it either.
  //
  // No retries: user-initiated command, one attempt + fail-open. The user
  // can re-run /reload-plugins to retry. Startup path keeps its retries.
  if (
    feature('DOWNLOAD_USER_SETTINGS') &&
    (isEnvTruthy(process.env.CLAUDE_CODE_REMOTE) || getIsRemoteMode())
  ) {
    const applied = await redownloadUserSettings()
    // applyRemoteEntriesToLocal uses markInternalWrite to suppress the
    // file watcher (correct for startup, nothing listening yet); fire
    // notifyChange here so mid-session applySettingsChange runs.
    if (applied) {
      settingsChangeDetector.notifyChange('userSettings')
    }
  }

  const r = await refreshActivePlugins(context.setAppState)

  const parts = [
    n(r.enabled_count, '插件'),
    n(r.command_count, '技能'),
    n(r.agent_count, '智能体'),
    n(r.hook_count, '钩子'),
    // "plugin MCP/LSP" disambiguates from user-config/built-in servers,
    // which /reload-plugins doesn't touch. Commands/hooks are plugin-only;
    // agent_count is total agents (incl. built-ins). (gh-31321)
    n(r.mcp_count, '插件 MCP 服务器'),
    n(r.lsp_count, '插件 LSP 服务器'),
  ]
  let msg = `已重新加载：${parts.join(' · ')}`

  if (r.error_count > 0) {
    msg += `\n加载期间出现 ${n(r.error_count, '错误')}。请检查插件配置或运行 /plugin manage 查看详情。`
  }

  return { type: 'text', value: msg }
}

function n(count: number, noun: string): string {
  return `${count} 个${noun}`
}
