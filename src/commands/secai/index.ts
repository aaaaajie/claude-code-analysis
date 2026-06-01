import type { Command } from '../../commands.js'

const secai = {
  type: 'local',
  name: 'secai',
  description:
    'Manage SecAI login, registration, balance, usage, and model routing',
  argumentHint:
    'login|use|send-code|register|reset-password|balance|usage|recharge|status|logout',
  supportsNonInteractive: true,
  isSensitive: true,
  disableModelInvocation: true,
  load: () => import('./secai.js'),
} satisfies Command

export default secai
