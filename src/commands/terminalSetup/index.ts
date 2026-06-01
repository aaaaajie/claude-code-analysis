import type { Command } from '../../commands.js'
import { env } from '../../utils/env.js'

const terminalSetup = {
  type: 'local-jsx',
  name: 'terminal-setup',
  description:
    env.terminal === 'Apple_Terminal'
      ? 'Enable Option+Enter key binding for newlines and visual bell'
      : 'Install Shift+Enter key binding for newlines',
  isHidden: true,
  load: () => import('./terminalSetup.js'),
} satisfies Command

export default terminalSetup
