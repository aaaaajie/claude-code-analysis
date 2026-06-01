import type { Command } from '../../commands.js'

export default {
  type: 'local-jsx',
  name: 'usage',
  description: '显示套餐使用限额',
  availability: ['claude-ai'],
  load: () => import('./usage.js'),
} satisfies Command
