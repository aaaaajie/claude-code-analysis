import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js'

export const DESCRIPTION = '创建任务列表中的新任务'

export function getPrompt(): string {
  const teammateContext = isAgentSwarmsEnabled()
    ? ' and potentially assigned to teammates'
    : ''

  const teammateTips = isAgentSwarmsEnabled()
    ? `- Include enough detail in the description for another agent to understand and complete the task
- New tasks are created with status 'pending' and no owner - use TaskUpdate with the \`owner\` parameter to assign them
`
    : ''

  return `使用此工具为当前会话创建结构化任务列表，用来跟踪进度、组织复杂任务，并让用户清楚看到当前工作进展。

## When to Use This Tool

Use this tool proactively in these scenarios:

- Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
- Non-trivial and complex tasks - Tasks that require careful planning or multiple operations${teammateContext}
- Plan mode - When using plan mode, create a task list to track the work
- User explicitly requests todo list - When the user directly asks you to use the todo list
- User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
- After receiving new instructions - Immediately capture user requirements as tasks
- When you start working on a task - Mark it as in_progress BEFORE beginning work
- After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation

## When NOT to Use This Tool

Skip using this tool when:
- There is only a single, straightforward task
- The task is trivial and tracking it provides no organizational benefit
- The task can be completed in less than 3 trivial steps
- The task is purely conversational or informational

NOTE that you should not use this tool if there is only one trivial task to do. In this case you are better off just doing the task directly.

## Task Fields

- **subject**: 简短、可执行的中文任务标题，例如“修复登录流程认证问题”
- **description**: 需要完成的具体内容，使用中文
- **activeForm** (optional): 任务进行中显示在状态栏的中文短语，例如“修复登录问题中”“扫描项目中”。必须使用中文，不要写成 "Running tests"、"Scanning files" 这类英文现在进行时。如果省略，状态栏会显示 subject。

All tasks are created with status \`pending\`.

## Tips

- Create tasks with clear, specific Chinese subjects that describe the outcome
- After creating tasks, use TaskUpdate to set up dependencies (blocks/blockedBy) if needed
${teammateTips}- Check TaskList first to avoid creating duplicate tasks
`
}
