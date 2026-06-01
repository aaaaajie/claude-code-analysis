import type { Command } from '../../commands.js'
const voice = {
  type: 'local',
  name: 'voice',
  description: '切换语音模式',
  isEnabled: () => false,
  get isHidden() {
    return true
  },
  supportsNonInteractive: false,
  load: () => import('./voice.js'),
} satisfies Command

export default voice
