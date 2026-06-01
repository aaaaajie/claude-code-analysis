import type { Command } from '../../commands.js'

const skillInstall = {
  type: 'local',
  name: 'skill-install',
  aliases: ['skills-install'],
  description: 'Install SecAI skills from local paths or GitHub sources',
  argumentHint: '[--project] [--force] <source...>',
  supportsNonInteractive: true,
  disableModelInvocation: true,
  load: () => import('./skill-install.js'),
} satisfies Command

export default skillInstall
