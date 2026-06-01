import {
  getAutoMemEntrypoint,
  getAutoMemPath,
  isAutoMemoryEnabled,
} from '../../memdir/paths.js'
import { registerBundledSkill } from '../bundledSkills.js'

function buildSkillPrompt(): string {
  const autoMemPath = getAutoMemPath()
  const autoMemEntrypoint = getAutoMemEntrypoint()

  return `# Memory Review

## Goal
Review the user's SecAI memory landscape and produce a clear report of proposed changes, grouped by action type. Do NOT apply changes — present proposals for user approval.

## Local SecAI memory paths

- Auto-memory directory: \`${autoMemPath}\`
- Auto-memory index: \`${autoMemEntrypoint}\`
- Daily logs, if present: \`${autoMemPath}logs/YYYY/MM/YYYY-MM-DD.md\`

## Steps

### 1. Gather all memory layers
Read memory from these layers:
- Project instructions: \`AGENTS.md\` and \`AGENTS.local.md\` from the project root, if they exist
- SecAI project rules: \`.secai/AGENTS.md\` and \`.secai/rules/**/*.md\`, if they exist
- User instructions: \`~/.secai/SECAI.md\`, if it exists
- Auto-memory: read the auto-memory index above, all linked memory files, and recent daily logs under \`logs/\` if present
- Team memory: note \`team/\` under the auto-memory directory if it exists

**Success criteria**: You have the contents of all memory layers and can compare them.

### 2. Classify each auto-memory entry
For each substantive entry in auto-memory, determine the best destination:

| Destination | What belongs there | Examples |
|---|---|---|
| **AGENTS.md** | Project conventions and instructions for SecAI that all contributors should follow | "use bun not npm", "API routes use kebab-case", "test command is bun test", "prefer functional style" |
| **AGENTS.local.md** | Personal instructions for SecAI specific to this user, not applicable to other contributors | "I prefer concise responses", "always explain trade-offs", "don't auto-commit", "run tests before committing" |
| **~/.secai/SECAI.md** | Personal instructions that should follow this user across all repositories | "回答保持简洁", "修改代码前先阅读现有模式", "默认用中文解释方案" |
| **Team memory** | Org-wide knowledge that applies across repositories (only if team memory is configured) | "deploy PRs go through #deploy-queue", "staging is at staging.internal", "platform team owns infra" |
| **Stay in auto-memory** | Working notes, temporary context, or entries that don't clearly fit elsewhere | Session-specific observations, uncertain patterns |

**Important distinctions:**
- AGENTS.md and AGENTS.local.md contain instructions for SecAI, not user preferences for external tools (editor theme, IDE keybindings, etc. don't belong in either)
- Prefer keeping high-volume observations in auto-memory and promoting only stable, reusable guidance into SECAI files
- Workflow practices (PR conventions, merge strategies, branch naming) are ambiguous — ask the user whether they're personal or team-wide
- When unsure, ask rather than guess

**Success criteria**: Each entry has a proposed destination or is flagged as ambiguous.

### 3. Identify cleanup opportunities
Scan across all layers for:
- **Duplicates**: Auto-memory entries already captured in AGENTS.md or AGENTS.local.md → propose removing from auto-memory
- **Outdated**: AGENTS.md or AGENTS.local.md entries contradicted by newer auto-memory entries → propose updating the older layer
- **Conflicts**: Contradictions between any two layers → propose resolution, noting which is more recent
- **Index drift**: Auto-memory files that are not referenced from MEMORY.md, or MEMORY.md links whose target files no longer exist

**Success criteria**: All cross-layer issues identified.

### 4. Present the report
Output a structured report grouped by action type:
1. **Promotions** — entries to move, with destination and rationale
2. **Cleanup** — duplicates, outdated entries, conflicts to resolve
3. **Ambiguous** — entries where you need the user's input on destination
4. **No action needed** — brief note on entries that should stay put

If auto-memory is empty, say so and offer to review AGENTS.md for cleanup.

**Success criteria**: User can review and approve/reject each proposal individually.

## Rules
- Present ALL proposals before making any changes
- Do NOT modify files without explicit user approval
- Do NOT create new files unless the target doesn't exist yet
- Ask about ambiguous entries — don't guess
- When applying approved cleanup, keep memory files topic-oriented and update MEMORY.md links instead of dumping full memory content into the index
`
}

export function registerRememberSkill(): void {
  registerBundledSkill({
    name: 'remember',
    description:
      '审阅 SecAI 本地自动记忆，建议提升到 AGENTS.md、AGENTS.local.md、~/.secai/SECAI.md 或共享记忆，并检查过期、冲突、重复和未索引内容。',
    whenToUse:
      '当用户需要审阅、整理、持久化或提升 SecAI 自动记忆时使用，也适合清理 AGENTS.md、AGENTS.local.md、~/.secai/SECAI.md 和自动记忆中的过期或冲突内容。',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'AskUserQuestion'],
    userInvocable: true,
    isEnabled: () => isAutoMemoryEnabled(),
    async getPromptForCommand(args) {
      let prompt = buildSkillPrompt()

      if (args) {
        prompt += `\n## Additional context from user\n\n${args}`
      }

      return [{ type: 'text', text: prompt }]
    },
  })
}
