import type { Command } from '../../commands.js'

const rewind = {
  description: `将代码和/或对话回退到之前的位置`,
  name: 'rewind',
  aliases: ['checkpoint'],
  argumentHint: '',
  isHidden: true,
  type: 'local',
  supportsNonInteractive: false,
  load: () => import('./rewind.js'),
} satisfies Command

export default rewind
