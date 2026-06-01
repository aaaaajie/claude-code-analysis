import { getProjectRoot } from '../../bootstrap/state.js'
import { registerBundledSkill } from '../bundledSkills.js'
import {
  formatSkillInstallResult,
  helpText,
  installSkills,
  parseSkillInstallArgs,
} from '../../utils/skills/skillInstaller.js'

const SKILL_INSTALLER_PROMPT = `# SecAI Skill Installer

Install SecAI skills only through the deterministic installer. Do not manually create skill directories unless the installer reports an unsupported source.

Use this skill when the user asks to install one or more skills from a GitHub URL, raw SKILL.md URL, local path, or owner/repo plus paths.

Supported forms:
- \`/skill-install https://github.com/org/repo/tree/main/skills/foo\`
- \`/skill-install https://raw.githubusercontent.com/org/repo/main/foo/SKILL.md\`
- \`/skill-install org/repo skills/foo skills/bar\`
- \`/skill-install ./local-skill-dir\`
- Add \`--project\` to install into the current project's \`.secai/skills\`
- Add \`--force\` to replace an existing skill after backing it up

If the user gave exact sources, invoke this skill with those arguments. If the source is ambiguous, ask for the exact URL, repo/path, or local path.`

export function registerSkillInstallerSkill(): void {
  registerBundledSkill({
    name: 'skill-installer',
    aliases: ['skills-installer'],
    description:
      '安装 SecAI skills。支持 GitHub URL、raw SKILL.md、本地路径和 owner/repo + path 批量安装。',
    whenToUse:
      'Use when the user asks to install, add, download, or import one or more SecAI skills from a name, GitHub URL, raw SKILL.md URL, local path, or repo/path. Examples: "安装这个 skill", "帮我安装这些 skills", "install org/repo skills/foo".',
    allowedTools: ['Write(~/.secai/skills/**)', 'Write(.secai/skills/**)'],
    userInvocable: true,
    argumentHint: '[--project] [--force] <source...>',
    async getPromptForCommand(args) {
      if (!args.trim()) {
        return [{ type: 'text', text: SKILL_INSTALLER_PROMPT + '\n\n' + helpText() }]
      }

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
        const { clearCommandsCache } = await import('../../commands.js')
        clearCommandsCache()
        return [
          {
            type: 'text',
            text:
              formatSkillInstallResult(result) +
              '\n\n安装已完成。直接向用户报告结果，不要重复安装。',
          },
        ]
      } catch (error) {
        return [
          {
            type: 'text',
            text:
              `SecAI skill 安装失败：${error instanceof Error ? error.message : String(error)}\n\n` +
              '向用户说明失败原因，并在需要时让用户提供明确的 GitHub URL、raw SKILL.md URL、owner/repo + path 或本地路径。',
          },
        ]
      }
    },
  })
}
