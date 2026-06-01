import type { Command } from '../../commands.js'

const command = {
  name: 'vim',
  description: '在 Vim 和普通编辑模式间切换',
  isHidden: true,
  supportsNonInteractive: false,
  type: 'local',
  load: () => import('./vim.js'),
} satisfies Command

export default command
