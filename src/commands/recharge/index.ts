import type { Command } from '../../commands.js'

const recharge = {
  type: 'local',
  name: 'recharge',
  description: '查看 SecAI 充值方式和联系方式',
  supportsNonInteractive: true,
  load: () => import('./recharge.js'),
} satisfies Command

export default recharge
