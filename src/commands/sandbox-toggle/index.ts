import figures from 'figures'
import type { Command } from '../../commands.js'
import { SandboxManager } from '../../utils/sandbox/sandbox-adapter.js'

const command = {
  name: 'sandbox',
  get description() {
    const currentlyEnabled = SandboxManager.isSandboxingEnabled()
    const autoAllow = SandboxManager.isAutoAllowBashIfSandboxedEnabled()
    const allowUnsandboxed = SandboxManager.areUnsandboxedCommandsAllowed()
    const isLocked = SandboxManager.areSandboxSettingsLockedByPolicy()
    const hasDeps = SandboxManager.checkDependencies().errors.length === 0

    // Show warning icon if dependencies are missing; otherwise show status.
    let icon: string
    if (!hasDeps) {
      icon = figures.warning
    } else {
      icon = currentlyEnabled ? figures.tick : figures.circle
    }

    let statusText = '沙箱已关闭'
    if (currentlyEnabled) {
      statusText = autoAllow
        ? '沙箱已启用（自动允许）'
        : '沙箱已启用'

      statusText += allowUnsandboxed ? '，允许非沙箱回退' : ''
    }

    if (isLocked) {
      statusText += '（托管）'
    }

    return `${icon} ${statusText}（按 ⏎ 配置）`
  },
  argumentHint: 'exclude "command pattern"',
  get isHidden() {
    return (
      !SandboxManager.isSupportedPlatform() ||
      !SandboxManager.isPlatformInEnabledList()
    )
  },
  immediate: true,
  type: 'local-jsx',
  load: () => import('./sandbox-toggle.js'),
} satisfies Command

export default command
