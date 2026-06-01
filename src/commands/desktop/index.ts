import type { Command } from '../../commands.js'

function isSupportedPlatform(): boolean {
  if (process.platform === 'darwin') {
    return true
  }
  if (process.platform === 'win32' && process.arch === 'x64') {
    return true
  }
  return false
}

const desktop = {
  type: 'local-jsx',
  name: 'desktop',
  aliases: ['app'],
  description: '在桌面端继续当前会话',
  isEnabled: () => false,
  get isHidden() {
    return true
  },
  load: () => import('./desktop.js'),
} satisfies Command

export default desktop
