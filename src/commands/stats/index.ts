import type { Command } from '../../commands.js'

const stats = {
  type: 'local-jsx',
  name: 'stats',
  description: '显示你的 SecAI 使用统计和活动记录',
  load: () => import('./stats.js'),
} satisfies Command

export default stats
