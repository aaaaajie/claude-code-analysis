import type { Command } from '../../commands.js'

const command: Command = {
  name: 'chrome',
  description: 'Chrome 集成设置',
  isEnabled: () => false,
  isHidden: true,
  type: 'local-jsx',
  load: () => import('./chrome.js'),
}

export default command
