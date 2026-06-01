/**
 * Cost command - minimal metadata only.
 * Implementation is lazy-loaded from cost.ts to reduce startup time.
 */
import type { Command } from '../../commands.js'

const cost = {
  type: 'local',
  name: 'cost',
  description: '显示 SecAI 余额、最近用量和本地会话统计',
  supportsNonInteractive: true,
  load: () => import('./cost.js'),
} satisfies Command

export default cost
