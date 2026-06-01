import { getProjectRoot } from '../../bootstrap/state.js'
import { clearCommandsCache } from '../../commands.js'
import type { LocalCommandCall } from '../../types/command.js'
import {
  formatSkillInstallResult,
  installSkills,
  parseSkillInstallArgs,
} from '../../utils/skills/skillInstaller.js'

export const call: LocalCommandCall = async args => {
  try {
    const parsed = parseSkillInstallArgs(args)
    const result = await installSkills({
      sources: parsed.sources,
      scope: parsed.scope,
      cwd: getProjectRoot(),
      force: parsed.force,
      name: parsed.name,
      ref: parsed.ref,
    })
    clearCommandsCache()
    return { type: 'text', value: formatSkillInstallResult(result) }
  } catch (error) {
    return {
      type: 'text',
      value: error instanceof Error ? error.message : String(error),
    }
  }
}
