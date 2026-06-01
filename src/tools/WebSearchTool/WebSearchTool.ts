import type {
  BetaContentBlock,
  BetaWebSearchTool20250305,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import { getAPIProvider } from 'src/utils/model/providers.js'
import type { PermissionResult } from 'src/utils/permissions/PermissionResult.js'
import { z } from 'zod/v4'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { queryModelWithStreaming } from '../../services/api/claude.js'
import { isSecAIActive } from '../../services/secai/client.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { logError } from '../../utils/log.js'
import { createUserMessage } from '../../utils/messages.js'
import { getMainLoopModel, getSmallFastModel } from '../../utils/model/model.js'
import { jsonParse, jsonStringify } from '../../utils/slowOperations.js'
import { asSystemPrompt } from '../../utils/systemPromptType.js'
import { getWebSearchPrompt, WEB_SEARCH_TOOL_NAME } from './prompt.js'
import {
  getToolUseSummary,
  renderToolResultMessage,
  renderToolUseMessage,
  renderToolUseProgressMessage,
} from './UI.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    query: z.string().min(2).describe('The search query to use'),
    allowed_domains: z
      .array(z.string())
      .optional()
      .describe('Only include search results from these domains'),
    blocked_domains: z
      .array(z.string())
      .optional()
      .describe('Never include search results from these domains'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

type Input = z.infer<InputSchema>

type SearchHit = {
  title: string
  url: string
}

const searchResultSchema = lazySchema(() => {
  const searchHitSchema = z.object({
    title: z.string().describe('The title of the search result'),
    url: z.string().describe('The URL of the search result'),
  })

  return z.object({
    tool_use_id: z.string().describe('ID of the tool use'),
    content: z.array(searchHitSchema).describe('Array of search hits'),
  })
})

export type SearchResult = z.infer<ReturnType<typeof searchResultSchema>>

const outputSchema = lazySchema(() =>
  z.object({
    query: z.string().describe('The search query that was executed'),
    results: z
      .array(z.union([searchResultSchema(), z.string()]))
      .describe('Search results and/or text commentary from the model'),
    durationSeconds: z
      .number()
      .describe('Time taken to complete the search operation'),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>

// Re-export WebSearchProgress from centralized types to break import cycles
export type { WebSearchProgress } from '../../types/tools.js'

import type { WebSearchProgress } from '../../types/tools.js'

function makeToolSchema(input: Input): BetaWebSearchTool20250305 {
  return {
    type: 'web_search_20250305',
    name: 'web_search',
    allowed_domains: input.allowed_domains,
    blocked_domains: input.blocked_domains,
    max_uses: 8, // Hardcoded to 8 searches maximum
  }
}

function makeOutputFromSearchResponse(
  result: BetaContentBlock[],
  query: string,
  durationSeconds: number,
): Output {
  // The result is a sequence of these blocks:
  // - text to start -- always?
  // [
  //    - server_tool_use
  //    - web_search_tool_result
  //    - text and citation blocks intermingled
  //  ]+  (this block repeated for each search)

  const results: (SearchResult | string)[] = []
  let textAcc = ''
  let inText = true

  for (const block of result) {
    if (block.type === 'server_tool_use') {
      if (inText) {
        inText = false
        if (textAcc.trim().length > 0) {
          results.push(textAcc.trim())
        }
        textAcc = ''
      }
      continue
    }

    if (block.type === 'web_search_tool_result') {
      // Handle error case - content is a WebSearchToolResultError
      if (!Array.isArray(block.content)) {
        const errorMessage = `Web search error: ${block.content.error_code}`
        logError(new Error(errorMessage))
        results.push(errorMessage)
        continue
      }
      // Success case - add results to our collection
      const hits = block.content.map(r => ({ title: r.title, url: r.url }))
      results.push({
        tool_use_id: block.tool_use_id,
        content: hits,
      })
    }

    if (block.type === 'text') {
      if (inText) {
        textAcc += block.text
      } else {
        inText = true
        textAcc = block.text
      }
    }
  }

  if (textAcc.length) {
    results.push(textAcc.trim())
  }

  return {
    query,
    results,
    durationSeconds,
  }
}

async function callSecAIWebSearch(
  input: Input,
  signal: AbortSignal,
  startTime: number,
  onProgress?: (progress: {
    toolUseID: string
    data: WebSearchProgress
  }) => void,
): Promise<{ data: Output }> {
  const hits = await secAIWebSearch(input, signal)
  onProgress?.({
    toolUseID: `secai-search-${Date.now()}`,
    data: {
      type: 'search_results_received',
      resultCount: hits.length,
      query: input.query,
    },
  })

  return {
    data: {
      query: input.query,
      results: [
        {
          tool_use_id: `secai-search-${Date.now()}`,
          content: hits,
        },
      ],
      durationSeconds: (performance.now() - startTime) / 1000,
    },
  }
}

async function secAIWebSearch(
  input: Input,
  signal: AbortSignal,
): Promise<SearchHit[]> {
  const configured = process.env.SECAI_WEB_SEARCH_URL?.trim()
  const hits = configured
    ? await searchConfiguredEndpoint(configured, input, signal)
    : await searchPublicHTML(input, signal)
  return filterSearchHits(hits, input).slice(0, 8)
}

async function searchConfiguredEndpoint(
  endpoint: string,
  input: Input,
  signal: AbortSignal,
): Promise<SearchHit[]> {
  const url = new URL(endpoint)
  url.searchParams.set('q', input.query)
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`SecAI web search endpoint failed: HTTP ${response.status}`)
  }
  const payload = (await response.json()) as unknown
  return searchHitsFromJSON(payload)
}

function searchHitsFromJSON(payload: unknown): SearchHit[] {
  const root = payload as
    | { results?: unknown; content?: unknown; data?: unknown }
    | unknown[]
  const items = Array.isArray(root)
    ? root
    : Array.isArray(root?.results)
      ? root.results
      : Array.isArray(root?.content)
        ? root.content
        : Array.isArray(root?.data)
          ? root.data
          : []

  return items.flatMap(item => {
    if (!item || typeof item !== 'object') {
      return []
    }
    const record = item as {
      title?: unknown
      name?: unknown
      url?: unknown
      link?: unknown
      href?: unknown
    }
    const title = firstString(record.title, record.name)
    const url = firstString(record.url, record.link, record.href)
    return title && url ? [{ title, url }] : []
  })
}

async function searchDuckDuckGoHTML(
  input: Input,
  signal: AbortSignal,
): Promise<SearchHit[]> {
  const url = new URL('https://html.duckduckgo.com/html/')
  url.searchParams.set('q', input.query)
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'text/html',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  })
  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed: HTTP ${response.status}`)
  }
  return parseDuckDuckGoHTML(await response.text())
}

async function searchPublicHTML(
  input: Input,
  signal: AbortSignal,
): Promise<SearchHit[]> {
  const errors: string[] = []
  try {
    const hits = await searchDuckDuckGoHTML(input, signal)
    if (hits.length > 0) {
      return hits
    }
    errors.push('DuckDuckGo returned no parseable results')
  } catch (error) {
    errors.push(`DuckDuckGo: ${error instanceof Error ? error.message : String(error)}`)
  }

  try {
    const hits = await searchBingHTML(input, signal)
    if (hits.length > 0) {
      return hits
    }
    errors.push('Bing returned no parseable results')
  } catch (error) {
    errors.push(`Bing: ${error instanceof Error ? error.message : String(error)}`)
  }

  throw new Error(
    `SecAI web search simulation failed. Configure SECAI_WEB_SEARCH_URL for a stable search backend. ${errors.join('; ')}`,
  )
}

async function searchBingHTML(
  input: Input,
  signal: AbortSignal,
): Promise<SearchHit[]> {
  const url = new URL('https://www.bing.com/search')
  url.searchParams.set('q', input.query)
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'text/html',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  })
  if (!response.ok) {
    throw new Error(`Bing search failed: HTTP ${response.status}`)
  }
  return parseBingHTML(await response.text())
}

function parseDuckDuckGoHTML(html: string): SearchHit[] {
  const hits: SearchHit[] = []
  const linkPattern =
    /<a\b[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  for (const match of html.matchAll(linkPattern)) {
    const rawURL = decodeHTMLEntities(match[1] ?? '')
    const title = cleanHTMLText(match[2] ?? '')
    const url = unwrapDuckDuckGoURL(rawURL)
    if (title && url) {
      hits.push({ title, url })
    }
    if (hits.length >= 12) {
      break
    }
  }
  return hits
}

function parseBingHTML(html: string): SearchHit[] {
  const hits: SearchHit[] = []
  const linkPattern =
    /<li\b[^>]*class="[^"]*\bb_algo\b[^"]*"[\s\S]*?<h2[^>]*>\s*<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  for (const match of html.matchAll(linkPattern)) {
    const url = decodeHTMLEntities(match[1] ?? '')
    const title = cleanHTMLText(match[2] ?? '')
    if (title && url) {
      hits.push({ title, url })
    }
    if (hits.length >= 12) {
      break
    }
  }
  return hits
}

function unwrapDuckDuckGoURL(rawURL: string): string {
  try {
    const url = new URL(rawURL, 'https://duckduckgo.com')
    const unwrapped = url.searchParams.get('uddg')
    return unwrapped || url.toString()
  } catch {
    return rawURL
  }
}

function filterSearchHits(hits: SearchHit[], input: Input): SearchHit[] {
  const allowed = input.allowed_domains?.map(domain => domain.toLowerCase())
  const blocked = input.blocked_domains?.map(domain => domain.toLowerCase())
  return dedupeSearchHits(
    hits.filter(hit => {
      const hostname = hostnameOf(hit.url)
      if (!hostname) {
        return false
      }
      if (allowed?.length && !allowed.some(domain => hostnameMatches(hostname, domain))) {
        return false
      }
      if (blocked?.some(domain => hostnameMatches(hostname, domain))) {
        return false
      }
      return true
    }),
  )
}

function dedupeSearchHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>()
  return hits.filter(hit => {
    if (seen.has(hit.url)) {
      return false
    }
    seen.add(hit.url)
    return true
  })
}

function hostnameOf(rawURL: string): string | null {
  try {
    return new URL(rawURL).hostname.toLowerCase()
  } catch {
    return null
  }
}

function hostnameMatches(hostname: string, domain: string): boolean {
  const normalized = domain.replace(/^\*\./, '').toLowerCase()
  return hostname === normalized || hostname.endsWith(`.${normalized}`)
}

function cleanHTMLText(html: string): string {
  return decodeHTMLEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

export const WebSearchTool = buildTool({
  name: WEB_SEARCH_TOOL_NAME,
  searchHint: 'search the web for current information',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  async description(input) {
    return `Claude wants to search the web for: ${input.query}`
  },
  userFacingName() {
    return 'Web Search'
  },
  getToolUseSummary,
  getActivityDescription(input) {
    const summary = getToolUseSummary(input)
    return summary ? `Searching for ${summary}` : 'Searching the web'
  },
  isEnabled() {
    if (isSecAIActive()) {
      return true
    }
    const provider = getAPIProvider()
    const model = getMainLoopModel()

    // Enable for firstParty
    if (provider === 'firstParty') {
      return true
    }

    // Enable for Vertex AI with supported models (Claude 4.0+)
    if (provider === 'vertex') {
      const supportsWebSearch =
        model.includes('claude-opus-4') ||
        model.includes('claude-sonnet-4') ||
        model.includes('claude-haiku-4')

      return supportsWebSearch
    }

    // Foundry only ships models that already support Web Search
    if (provider === 'foundry') {
      return true
    }

    return false
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  toAutoClassifierInput(input) {
    return input.query
  },
  async checkPermissions(_input): Promise<PermissionResult> {
    return {
      behavior: 'passthrough',
      message: 'WebSearchTool requires permission.',
      suggestions: [
        {
          type: 'addRules',
          rules: [{ toolName: WEB_SEARCH_TOOL_NAME }],
          behavior: 'allow',
          destination: 'localSettings',
        },
      ],
    }
  },
  async prompt() {
    return getWebSearchPrompt()
  },
  renderToolUseMessage,
  renderToolUseProgressMessage,
  renderToolResultMessage,
  extractSearchText() {
    // renderToolResultMessage shows only "Did N searches in Xs" chrome —
    // the results[] content never appears on screen. Heuristic would index
    // string entries in results[] (phantom match). Nothing to search.
    return ''
  },
  async validateInput(input) {
    const { query, allowed_domains, blocked_domains } = input
    if (!query.length) {
      return {
        result: false,
        message: 'Error: Missing query',
        errorCode: 1,
      }
    }
    if (allowed_domains?.length && blocked_domains?.length) {
      return {
        result: false,
        message:
          'Error: Cannot specify both allowed_domains and blocked_domains in the same request',
        errorCode: 2,
      }
    }
    return { result: true }
  },
  async call(input, context, _canUseTool, _parentMessage, onProgress) {
    const startTime = performance.now()
    const { query } = input
    if (isSecAIActive()) {
      return callSecAIWebSearch(
        input,
        context.abortController.signal,
        startTime,
        onProgress,
      )
    }

    const userMessage = createUserMessage({
      content: 'Perform a web search for the query: ' + query,
    })
    const toolSchema = makeToolSchema(input)

    const useHaiku = getFeatureValue_CACHED_MAY_BE_STALE(
      'tengu_plum_vx3',
      false,
    )

    const appState = context.getAppState()
    const queryStream = queryModelWithStreaming({
      messages: [userMessage],
      systemPrompt: asSystemPrompt([
        'You are an assistant for performing a web search tool use',
      ]),
      thinkingConfig: useHaiku
        ? { type: 'disabled' as const }
        : context.options.thinkingConfig,
      tools: [],
      signal: context.abortController.signal,
      options: {
        getToolPermissionContext: async () => appState.toolPermissionContext,
        model: useHaiku ? getSmallFastModel() : context.options.mainLoopModel,
        toolChoice: useHaiku ? { type: 'tool', name: 'web_search' } : undefined,
        isNonInteractiveSession: context.options.isNonInteractiveSession,
        hasAppendSystemPrompt: !!context.options.appendSystemPrompt,
        extraToolSchemas: [toolSchema],
        querySource: 'web_search_tool',
        agents: context.options.agentDefinitions.activeAgents,
        mcpTools: [],
        agentId: context.agentId,
        effortValue: appState.effortValue,
      },
    })

    const allContentBlocks: BetaContentBlock[] = []
    let currentToolUseId = null
    let currentToolUseJson = ''
    let progressCounter = 0
    const toolUseQueries = new Map() // Map of tool_use_id to query

    for await (const event of queryStream) {
      if (event.type === 'assistant') {
        allContentBlocks.push(...event.message.content)
        continue
      }

      // Track tool use ID when server_tool_use starts
      if (
        event.type === 'stream_event' &&
        event.event?.type === 'content_block_start'
      ) {
        const contentBlock = event.event.content_block
        if (contentBlock && contentBlock.type === 'server_tool_use') {
          currentToolUseId = contentBlock.id
          currentToolUseJson = ''
          // Note: The ServerToolUseBlock doesn't contain input.query
          // The actual query comes through input_json_delta events
          continue
        }
      }

      // Accumulate JSON for current tool use
      if (
        currentToolUseId &&
        event.type === 'stream_event' &&
        event.event?.type === 'content_block_delta'
      ) {
        const delta = event.event.delta
        if (delta?.type === 'input_json_delta' && delta.partial_json) {
          currentToolUseJson += delta.partial_json

          // Try to extract query from partial JSON for progress updates
          try {
            // Look for a complete query field
            const queryMatch = currentToolUseJson.match(
              /"query"\s*:\s*"((?:[^"\\]|\\.)*)"/,
            )
            if (queryMatch && queryMatch[1]) {
              // The regex properly handles escaped characters
              const query = jsonParse('"' + queryMatch[1] + '"')

              if (
                !toolUseQueries.has(currentToolUseId) ||
                toolUseQueries.get(currentToolUseId) !== query
              ) {
                toolUseQueries.set(currentToolUseId, query)
                progressCounter++
                if (onProgress) {
                  onProgress({
                    toolUseID: `search-progress-${progressCounter}`,
                    data: {
                      type: 'query_update',
                      query,
                    },
                  })
                }
              }
            }
          } catch {
            // Ignore parsing errors for partial JSON
          }
        }
      }

      // Yield progress when search results come in
      if (
        event.type === 'stream_event' &&
        event.event?.type === 'content_block_start'
      ) {
        const contentBlock = event.event.content_block
        if (contentBlock && contentBlock.type === 'web_search_tool_result') {
          // Get the actual query that was used for this search
          const toolUseId = contentBlock.tool_use_id
          const actualQuery = toolUseQueries.get(toolUseId) || query
          const content = contentBlock.content

          progressCounter++
          if (onProgress) {
            onProgress({
              toolUseID: toolUseId || `search-progress-${progressCounter}`,
              data: {
                type: 'search_results_received',
                resultCount: Array.isArray(content) ? content.length : 0,
                query: actualQuery,
              },
            })
          }
        }
      }
    }

    // Process the final result
    const endTime = performance.now()
    const durationSeconds = (endTime - startTime) / 1000

    const data = makeOutputFromSearchResponse(
      allContentBlocks,
      query,
      durationSeconds,
    )
    return { data }
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    const { query, results } = output

    let formattedOutput = `Web search results for query: "${query}"\n\n`

    // Process the results array - it can contain both string summaries and search result objects.
    // Guard against null/undefined entries that can appear after JSON round-tripping
    // (e.g., from compaction or transcript deserialization).
    ;(results ?? []).forEach(result => {
      if (result == null) {
        return
      }
      if (typeof result === 'string') {
        // Text summary
        formattedOutput += result + '\n\n'
      } else {
        // Search result with links
        if (result.content?.length > 0) {
          formattedOutput += `Links: ${jsonStringify(result.content)}\n\n`
        } else {
          formattedOutput += 'No links found.\n\n'
        }
      }
    })

    formattedOutput +=
      '\nREMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.'

    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: formattedOutput.trim(),
    }
  },
} satisfies ToolDef<InputSchema, Output, WebSearchProgress>)
