import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import { randomUUID } from 'crypto'
import type { Tools } from '../../Tool.js'
import {
  type JsonSchema7Type,
  zodToJsonSchema,
} from '../../utils/zodToJsonSchema.js'

const AGENT_TOOL_NAME = 'Agent'
const BASH_TOOL_NAME = 'Bash'
const WEB_FETCH_TOOL_NAME = 'WebFetch'

type DSMLParameter = {
  name: string
  value: unknown
}

type DSMLInvoke = {
  name: string
  parameters: DSMLParameter[]
}

const DSML_PREFIX = '[｜|]{2}DSML[｜|]{2}'
const TOOL_CALLS_RE = new RegExp(
  `<\\s*${DSML_PREFIX}tool_calls\\s*>([\\s\\S]*?)<\\/\\s*${DSML_PREFIX}tool_calls\\s*>`,
  'g',
)
const INVOKE_RE = new RegExp(
  `<\\s*${DSML_PREFIX}invoke\\s+([^>]*)>([\\s\\S]*?)<\\/\\s*${DSML_PREFIX}invoke\\s*>`,
  'g',
)
const PARAMETER_RE = new RegExp(
  `<\\s*${DSML_PREFIX}parameter\\s+([^>]*)>([\\s\\S]*?)<\\/\\s*${DSML_PREFIX}parameter\\s*>`,
  'g',
)
const ATTR_RE = /([a-zA-Z_][\w:-]*)="([^"]*)"/g

export function getSecAIDSMLToolUseInstructions(tools: Tools): string | null {
  if (tools.length === 0) {
    return null
  }

  const toolNames = tools.map(tool => tool.name).sort().join(', ')
  const hasAgentTool = hasTool(tools, AGENT_TOOL_NAME)
  const hasBashTool = hasTool(tools, BASH_TOOL_NAME)
  const hasWebFetchTool = hasTool(tools, WEB_FETCH_TOOL_NAME)
  const examples = [
    hasBashTool
      ? `<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="Bash">
<｜｜DSML｜｜parameter name="description" string="true">run requested shell command</｜｜DSML｜｜parameter>
<｜｜DSML｜｜parameter name="command" string="true">for i in 1 2 3; do echo 1; sleep 1; done</｜｜DSML｜｜parameter>
</｜｜DSML｜｜invoke>
</｜｜DSML｜｜tool_calls>`
      : null,
    hasAgentTool
      ? `<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="Agent">
<｜｜DSML｜｜parameter name="description" string="true">first loop worker</｜｜DSML｜｜parameter>
<｜｜DSML｜｜parameter name="prompt" string="true">Output "1" ten times, waiting one second between outputs.</｜｜DSML｜｜parameter>
</｜｜DSML｜｜invoke>
<｜｜DSML｜｜invoke name="Agent">
<｜｜DSML｜｜parameter name="description" string="true">second loop worker</｜｜DSML｜｜parameter>
<｜｜DSML｜｜parameter name="prompt" string="true">Output "1" ten times, waiting one second between outputs.</｜｜DSML｜｜parameter>
</｜｜DSML｜｜invoke>
</｜｜DSML｜｜tool_calls>`
      : null,
    hasWebFetchTool
      ? `<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="WebFetch">
<｜｜DSML｜｜parameter name="url" string="true">https://example.com</｜｜DSML｜｜parameter>
<｜｜DSML｜｜parameter name="prompt" string="true">Summarize the page and extract forms, scripts, endpoints, headers, and security-relevant details.</｜｜DSML｜｜parameter>
</｜｜DSML｜｜invoke>
</｜｜DSML｜｜tool_calls>`
      : null,
  ].filter(example => example !== null)
  const parameterReference = buildToolParameterReference(tools)

  return `# SecAI DSML tool protocol

The SecAI gateway accepts the normal tool schemas, but this model must express tool calls as DSML text so the CLI can convert them into executable tool_use blocks.

Available tool names: ${toolNames}

When the user asks you to execute a command, inspect or edit files, create agents, run agents, or perform a timed action, call the relevant tool with DSML. Do not say the action is complete until tool results are returned.
After tool results are returned, respond to the user with the observed result. Do not repeat the same tool call unless the result failed and another call is needed to recover.

Tool parameter quick reference:
${parameterReference}

DSML rules:
- Output one <｜｜DSML｜｜tool_calls> block containing one or more <｜｜DSML｜｜invoke name="ToolName"> blocks.
- Use only available tool names and exact parameter names from the tool schema.
- Put string parameters in <｜｜DSML｜｜parameter name="field" string="true">value</｜｜DSML｜｜parameter>.
- Put JSON parameters without string="true".
- WebFetch requires BOTH string parameters: url and prompt.
- For explicit http:// URLs, IP-address URLs, localhost/private hosts, non-standard ports, or security testing that needs headers/status, use Bash with curl instead of WebFetch because WebFetch upgrades HTTP to HTTPS and summarizes content.
- If WebFetch fails because the domain cannot be verified as safe to fetch, do not retry the same WebFetch call. Use Bash with curl when the user authorized fetching that URL and raw HTTP access is appropriate.
- Prefer Read on the task output file path for completed background tasks. Do not call TaskOutput unless you have an exact task_id from a tool result or /tasks; never invent or guess task IDs.
- Do not wrap DSML in markdown code fences.
- For independent work, emit multiple invokes in the same DSML block so they can run in parallel.
- For timed shell loops, prefer literal for loops like "for i in 1 2 3" over brace expansion or arithmetic substitution.

Examples:
${examples.join('\n\n')}`
}

export function normalizeDSMLToolCallsFromText(
  text: string,
  tools: Tools,
): BetaContentBlock[] | null {
  if (!text.includes('DSML') || !text.includes('tool_calls')) {
    return null
  }

  const blocks: BetaContentBlock[] = []
  let lastIndex = 0
  let convertedCount = 0

  for (const toolCallsMatch of text.matchAll(TOOL_CALLS_RE)) {
    const matchStart = toolCallsMatch.index ?? 0
    const before = text.slice(lastIndex, matchStart)
    appendTextBlock(blocks, before)

    const invokes = parseInvokes(toolCallsMatch[1] || '')
    for (const invoke of invokes) {
      if (!hasTool(tools, invoke.name)) {
        continue
      }
      const input = parametersToInput(invoke.parameters)
      blocks.push({
        type: 'tool_use',
        id: `toolu_secai_${randomUUID().replaceAll('-', '')}`,
        name: invoke.name,
        input,
      } as BetaContentBlock)
      convertedCount += 1
    }

    lastIndex = matchStart + toolCallsMatch[0].length
  }

  appendTextBlock(blocks, text.slice(lastIndex))

  if (convertedCount === 0) {
    return null
  }

  return blocks
}

function buildToolParameterReference(tools: Tools): string {
  return tools
    .map(tool => {
      const schema = getInputSchema(tool)
      const properties = getSchemaProperties(schema)
      if (!properties) {
        return `- ${tool.name}: parameters are defined by its tool schema.`
      }
      const required = new Set(
        Array.isArray(schema.required) ? schema.required.map(String) : [],
      )
      const fields = Object.entries(properties)
        .slice(0, 12)
        .map(([name, property]) => {
          const marker = required.has(name) ? 'required' : 'optional'
          return `${name}:${schemaTypeName(property)} ${marker}`
        })
      const suffix =
        Object.keys(properties).length > fields.length
          ? `, +${Object.keys(properties).length - fields.length} more`
          : ''
      return `- ${tool.name}: ${fields.join(', ')}${suffix}`
    })
    .join('\n')
}

function getInputSchema(tool: Tools[number]): JsonSchema7Type {
  if ('inputJSONSchema' in tool && tool.inputJSONSchema) {
    return tool.inputJSONSchema as JsonSchema7Type
  }
  return zodToJsonSchema(tool.inputSchema)
}

function getSchemaProperties(
  schema: JsonSchema7Type,
): Record<string, unknown> | null {
  const properties = schema.properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return null
  }
  return properties as Record<string, unknown>
}

function schemaTypeName(property: unknown): string {
  if (!property || typeof property !== 'object' || Array.isArray(property)) {
    return 'value'
  }
  const type = (property as { type?: unknown }).type
  if (typeof type === 'string') {
    return type
  }
  if (Array.isArray(type)) {
    return type.map(String).join('|')
  }
  if ('enum' in property) {
    return 'enum'
  }
  return 'value'
}

function parametersToInput(parameters: DSMLParameter[]): Record<string, unknown> {
  if (parameters.length === 1) {
    const [parameter] = parameters
    if (
      parameter &&
      ['input', 'arguments', 'parameters'].includes(parameter.name) &&
      isPlainObject(parameter.value)
    ) {
      return parameter.value
    }
  }
  return Object.fromEntries(
    parameters.map(parameter => [parameter.name, parameter.value]),
  )
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseInvokes(raw: string): DSMLInvoke[] {
  const invokes: DSMLInvoke[] = []

  for (const invokeMatch of raw.matchAll(INVOKE_RE)) {
    const attrs = parseAttrs(invokeMatch[1] || '')
    const name = attrs.name?.trim()
    if (!name) {
      continue
    }

    const parameters: DSMLParameter[] = []
    for (const parameterMatch of (invokeMatch[2] || '').matchAll(
      PARAMETER_RE,
    )) {
      const parameterAttrs = parseAttrs(parameterMatch[1] || '')
      const parameterName = parameterAttrs.name?.trim()
      if (!parameterName) {
        continue
      }
      parameters.push({
        name: parameterName,
        value: parseParameterValue(
          decodeEntities(parameterMatch[2] || ''),
          parameterAttrs,
        ),
      })
    }

    invokes.push({ name, parameters })
  }

  return invokes
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const match of raw.matchAll(ATTR_RE)) {
    attrs[match[1]!] = decodeEntities(match[2] || '')
  }
  return attrs
}

function parseParameterValue(
  rawValue: string,
  attrs: Record<string, string>,
): unknown {
  const value = rawValue.trim()
  if (attrs.string === 'true') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function appendTextBlock(blocks: BetaContentBlock[], text: string): void {
  if (text.trim().length === 0) {
    return
  }
  blocks.push({ type: 'text', text } as BetaContentBlock)
}

function hasTool(tools: Tools, name: string): boolean {
  return tools.some(tool => tool.name === name || tool.aliases?.includes(name))
}

function decodeEntities(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}
