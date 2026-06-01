import type { Command } from '../../commands.js'

const upgrade = {
  type: 'local-jsx',
  name: 'upgrade',
  description: '升级套餐以获得更高限额',
  isEnabled: () => false,
  isHidden: true,
  load: () => import('./upgrade.js'),
} satisfies Command

export default upgrade
