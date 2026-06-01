import type { Command } from '../../commands.js'

const mobile = {
  type: 'local-jsx',
  name: 'mobile',
  aliases: ['ios', 'android'],
  description: '显示移动端下载二维码',
  isEnabled: () => false,
  isHidden: true,
  load: () => import('./mobile.js'),
} satisfies Command

export default mobile
