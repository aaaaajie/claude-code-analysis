import type { Command } from '../../commands.js'
const feedback = {
  aliases: ['bug'],
  type: 'local-jsx',
  name: 'feedback',
  description: `提交关于 SecAI 的反馈`,
  argumentHint: '[report]',
  isEnabled: () => false,
  isHidden: true,
  load: () => import('./feedback.js'),
} satisfies Command

export default feedback
