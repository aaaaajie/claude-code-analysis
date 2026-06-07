import { queryHaiku } from '../../services/api/claude.js'
import type { Message } from '../../types/message.js'
import { logForDebugging } from '../../utils/debug.js'
import { errorMessage } from '../../utils/errors.js'
import { safeParseJSON } from '../../utils/json.js'
import { extractTextContent } from '../../utils/messages.js'
import { extractConversationText } from '../../utils/sessionTitle.js'
import { asSystemPrompt } from '../../utils/systemPromptType.js'

function normalizeGeneratedName(value: string): string | null {
  const trimmed = value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()

  if (!trimmed) return null

  const parsed = safeParseJSON(trimmed)
  if (
    parsed &&
    typeof parsed === 'object' &&
    'name' in parsed &&
    typeof (parsed as { name: unknown }).name === 'string'
  ) {
    return normalizeGeneratedName((parsed as { name: string }).name)
  }

  const jsonLike = trimmed.match(/"name"\s*:\s*"([^"]+)"/)
  if (jsonLike?.[1]) {
    return normalizeGeneratedName(jsonLike[1])
  }

  const firstLine = trimmed
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean)
  if (!firstLine) return null

  const asciiWords = firstLine
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter(word => word.length > 1)
    .slice(0, 4)

  if (asciiWords && asciiWords.length >= 2) {
    return asciiWords.join('-')
  }

  const cjk = firstLine.match(/[\u3400-\u9fff\uf900-\ufaff]/g)
  if (cjk && cjk.length >= 2) {
    return cjk.slice(0, 12).join('')
  }

  const compact = firstLine.replace(/\s+/g, '-').slice(0, 40)
  return compact || null
}

function fallbackSessionName(conversationText: string): string {
  const lines = conversationText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false
      if (line.startsWith('```')) return false
      if (/^(export|cd|npm|node|git|python|curl|\.\/)/.test(line)) return false
      return true
    })

  for (const line of lines.slice().reverse()) {
    const name = normalizeGeneratedName(line)
    if (name) return name
  }

  return 'renamed-session'
}

export async function generateSessionName(
  messages: Message[],
  signal: AbortSignal,
): Promise<string | null> {
  const conversationText = extractConversationText(messages)
  if (!conversationText) {
    return null
  }

  try {
    const result = await queryHaiku({
      systemPrompt: asSystemPrompt([
        'Generate a short conversation name. Use 2-4 lowercase words separated by hyphens when possible. Return only the name, with no JSON, no markdown, and no explanation. Examples: fix-login-bug, add-auth-feature, refactor-api-client, debug-test-failures.',
      ]),
      userPrompt: conversationText,
      signal,
      options: {
        querySource: 'rename_generate_name',
        agents: [],
        isNonInteractiveSession: false,
        hasAppendSystemPrompt: false,
        mcpTools: [],
      },
    })

    const content = extractTextContent(result.message.content)

    return normalizeGeneratedName(content) ?? fallbackSessionName(conversationText)
  } catch (error) {
    // Haiku timeout/rate-limit/network are expected operational failures —
    // logForDebugging, not logError. Called automatically on every 3rd bridge
    // message (initReplBridge.ts), so errors here would flood the error file.
    logForDebugging(`generateSessionName failed: ${errorMessage(error)}`, {
      level: 'error',
    })
    return fallbackSessionName(conversationText)
  }
}
