import { chmod, mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'

export const DEFAULT_SECAI_GATEWAY_URL = 'https://ai.rzsec.cn'
const LEGACY_LOCAL_SECAI_GATEWAY_URL = 'http://localhost:8080'
export const DEFAULT_SECAI_MODEL = 'sec-lab-lite'
export const DEFAULT_SECAI_ENV_FILE = join(homedir(), '.secai', '.env')
const DEFAULT_BOOTSTRAP_CREDIT_CNY = '1'
let lastSecAIEnvLogKey: string | undefined

export type SecAIModelPreset = {
  value: string
  label: string
  description: string
}

export const SECAI_MODEL_PRESETS: readonly SecAIModelPreset[] = [
  {
    value: DEFAULT_SECAI_MODEL,
    label: 'SecAI Lab Lite',
    description: '快速安全分析、问题分诊和日常指导。',
  },
  {
    value: 'sec-lab-max',
    label: 'SecAI Lab Max',
    description: '深度安全分析、架构审查和复杂问题调查。',
  },
  {
    value: 'sec-audit-lite',
    label: 'SecAI Audit Lite',
    description: '代码安全审计、加固建议和修复辅助。',
  },
  {
    value: 'sec-report-max',
    label: 'SecAI Report Max',
    description: '安全报告、影响说明和整改建议生成。',
  },
]

export function getSecAIModelPresets(): readonly SecAIModelPreset[] {
  return SECAI_MODEL_PRESETS
}

export function isSecAIModelPreset(model: string | null | undefined): boolean {
  if (!model) {
    return false
  }
  return SECAI_MODEL_PRESETS.some(preset => preset.value === model.trim())
}

export function getSecAIModelDisplayName(
  model: string | null | undefined,
): string | undefined {
  if (!model) {
    return undefined
  }
  return SECAI_MODEL_PRESETS.find(preset => preset.value === model.trim())
    ?.label
}

export function normalizeSecAIModel(model: string | null | undefined): string {
  const trimmed = model?.trim()
  return isSecAIModelPreset(trimmed) ? trimmed! : DEFAULT_SECAI_MODEL
}

export type SecAIConfig = {
  base_url: string
  api_key: string
  model?: string
  user?: SecAIUser
  balance?: SecAIConfigBalance
  created_at: string
  updated_at: string
}

export type SecAIUser = {
  id?: number
  username?: string
  nickname?: string
  email?: string
  phone?: string
}

export type SecAIConfigBalance = {
  user_id?: number
  balance_micro_cny?: number
  balance_cny?: string
}

export type SecAILoginResponse = {
  api_key: string
  user?: SecAIUser
  balance?: SecAIConfigBalance
}

export type SecAIAuthCodeResponse = {
  ok: boolean
  expires_in_seconds: number
  dev_code?: string
}

export type SecAIBalanceResponse = {
  user_id: number
  balance_micro_cny: number
  balance_cny: string
  last_usage?: SecAIUsageRecord
}

export type SecAIUsageResponse = {
  data: SecAIUsageRecord[]
}

export type SecAIUsageRecord = {
  id: number
  model_alias: string
  scenario_name: string
  status_code: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  revenue_micro_cny: number
  created_at: string
  error_message: string
}

type SecAIEnvDefaults = {
  gatewayURL: string
  apiKey?: string
  adminToken?: string
  bootstrapCreditCNY: string
}

export class SecAIRequestError extends Error {
  readonly status: number
  readonly retryAfter?: number

  constructor(message: string, status: number, retryAfter?: number) {
    super(message)
    this.name = 'SecAIRequestError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

export function getSecAIConfigPath(): string {
  return join(homedir(), '.secai', 'config.json')
}

export function getSecAILogPath(): string {
  return join(homedir(), '.secai', 'secai.log')
}

export function formatSecAIAccountDisplay(
  user: SecAIUser | undefined,
  fallbackAccount?: string,
): string | undefined {
  const value =
    user?.phone ||
    user?.email ||
    user?.nickname ||
    user?.username ||
    fallbackAccount
  return maskSecAIAccount(value)
}

export function maskSecAIAccount(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) {
    return undefined
  }
  const at = trimmed.indexOf('@')
  if (at > 0) {
    return `${maskMiddleFour(trimmed.slice(0, at))}${trimmed.slice(at)}`
  }
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 11) {
    return maskMiddleFour(digits)
  }
  return maskMiddleFour(trimmed)
}

function maskMiddleFour(value: string): string {
  if (value.length <= 4) {
    return '*'.repeat(value.length)
  }
  const start = Math.floor((value.length - 4) / 2)
  return `${value.slice(0, start)}****${value.slice(start + 4)}`
}

export function appendSecAILog(
  event: string,
  data: Record<string, unknown> = {},
): void {
  try {
    const path = getSecAILogPath()
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    appendFileSync(
      path,
      JSON.stringify({
        ts: new Date().toISOString(),
        event,
        pid: process.pid,
        cwd: process.cwd(),
        stdin_tty: process.stdin.isTTY === true,
        stdout_tty: process.stdout.isTTY === true,
        ...data,
      }) + '\n',
      { encoding: 'utf8', mode: 0o600 },
    )
  } catch {
    // Monitoring must never break the CLI.
  }
}

export function normalizeGatewayURL(raw: string | undefined): string {
  const value = (raw || DEFAULT_SECAI_GATEWAY_URL).trim()
  return value.replace(/\/+$/, '')
}

function normalizeStoredGatewayURL(raw: string | undefined): string {
  const value = normalizeGatewayURL(raw)
  return value === LEGACY_LOCAL_SECAI_GATEWAY_URL
    ? DEFAULT_SECAI_GATEWAY_URL
    : value
}

export function anthropicBaseURL(gatewayURL: string): string {
  const base = normalizeGatewayURL(gatewayURL)
  return base.endsWith('/anthropic') ? base : `${base}/anthropic`
}

export function gatewayURLFromAnthropicBaseURL(raw: string | undefined): string {
  if (!raw?.trim()) {
    return ''
  }
  const base = normalizeGatewayURL(raw)
  return base.endsWith('/anthropic')
    ? base.slice(0, -'/anthropic'.length)
    : base
}

export async function loadSecAIConfig(): Promise<SecAIConfig | null> {
  const path = getSecAIConfigPath()
  try {
    const raw = await readFile(path, 'utf8')
    return parseSecAIConfig(raw)
  } catch (error) {
    if (isNotFound(error)) {
      return null
    }
    throw error
  }
}

export function loadSecAIConfigSync(): SecAIConfig | null {
  const path = getSecAIConfigPath()
  if (!existsSync(path)) {
    return null
  }
  return parseSecAIConfig(readFileSync(path, 'utf8'))
}

export async function saveSecAIConfig(input: {
  baseURL: string
  apiKey: string
  model?: string
  user?: SecAIUser
  balance?: SecAIConfigBalance
}): Promise<SecAIConfig> {
  const now = new Date().toISOString()
  const existing = await loadSecAIConfig().catch(() => null)
  const config: SecAIConfig = {
    base_url: normalizeGatewayURL(input.baseURL),
    api_key: input.apiKey.trim(),
    model: normalizeSecAIModel(input.model),
    user: parseSecAIUser(input.user) || existing?.user,
    balance: parseSecAIConfigBalance(input.balance) || existing?.balance,
    created_at: existing?.created_at || now,
    updated_at: now,
  }

  const path = getSecAIConfigPath()
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, JSON.stringify(config, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  })
  await chmod(path, 0o600)
  applySecAIEnv(config)
  return config
}

export async function clearSecAIConfig(): Promise<void> {
  try {
    await unlink(getSecAIConfigPath())
  } catch (error) {
    if (!isNotFound(error)) {
      throw error
    }
  }
  delete process.env.SECAI_ACTIVE
  delete process.env.SECAI_GATEWAY_URL
  delete process.env.ANTHROPIC_BASE_URL
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_MODEL
  delete process.env.ANTHROPIC_SMALL_FAST_MODEL
  lastSecAIEnvLogKey = undefined
}

export async function applySecAIEnvFromConfig(): Promise<void> {
  if (process.env.SECAI_DISABLED === '1') {
    return
  }
  const config = await loadSecAIConfig()
  if (config) {
    applySecAIEnv(config)
  }
}

export function applySecAIEnvFromConfigSync(): void {
  if (process.env.SECAI_DISABLED === '1') {
    return
  }
  const config = loadSecAIConfigSync()
  if (config) {
    applySecAIEnv(config)
  }
}

export function applySecAIEnv(config: SecAIConfig): void {
  delete process.env.ANTHROPIC_AUTH_TOKEN
  delete process.env.ANTHROPIC_DEFAULT_OPUS_MODEL
  delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL
  delete process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL
  delete process.env.CLAUDE_CODE_SUBAGENT_MODEL
  delete process.env.CLAUDE_CODE_EFFORT_LEVEL

  process.env.SECAI_ACTIVE = '1'
  process.env.SECAI_GATEWAY_URL = config.base_url
  process.env.ANTHROPIC_BASE_URL = anthropicBaseURL(config.base_url)
  process.env.ANTHROPIC_API_KEY = config.api_key
  process.env.ANTHROPIC_MODEL = normalizeSecAIModel(config.model)
  process.env.ANTHROPIC_SMALL_FAST_MODEL = DEFAULT_SECAI_MODEL
  process.env.DISABLE_PROMPT_CACHING = '1'
  process.env.DISABLE_AUTOUPDATER ??= '1'
  process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC ??= '1'
  const logKey = [
    config.base_url,
    process.env.ANTHROPIC_BASE_URL,
    process.env.ANTHROPIC_MODEL,
    process.env.CLAUDE_CODE_SIMPLE,
    process.version,
    process.env.TERM_PROGRAM ?? '',
  ].join('|')
  if (lastSecAIEnvLogKey !== logKey) {
    lastSecAIEnvLogKey = logKey
    appendSecAILog('env_applied', {
      gateway_url: config.base_url,
      anthropic_base_url: process.env.ANTHROPIC_BASE_URL,
      model: process.env.ANTHROPIC_MODEL,
      simple: process.env.CLAUDE_CODE_SIMPLE,
      node: process.version,
      term_program: process.env.TERM_PROGRAM,
    })
  }
}

export function isSecAIActive(): boolean {
  return process.env.SECAI_ACTIVE === '1'
}

export type SecAIToolMode = 'dsml' | 'native' | 'auto'

export function getSecAIToolMode(): SecAIToolMode {
  const mode = process.env.SECAI_TOOL_MODE?.trim().toLowerCase()
  if (mode === 'native' || mode === 'auto' || mode === 'dsml') {
    return mode
  }
  return 'native'
}

export async function loginWithPassword(input: {
  baseURL?: string
  account: string
  password: string
  name?: string
}): Promise<SecAILoginResponse> {
  return secAIFetchJSON<SecAILoginResponse>({
    baseURL: input.baseURL,
    method: 'POST',
    path: '/auth/login',
    body: {
      account: input.account,
      password: input.password,
      name: input.name || 'secai',
    },
  })
}

export async function sendAuthCode(input: {
  baseURL?: string
  phone: string
  purpose: 'register' | 'reset_password'
}): Promise<SecAIAuthCodeResponse> {
  return secAIFetchJSON<SecAIAuthCodeResponse>({
    baseURL: input.baseURL,
    method: 'POST',
    path: '/auth/send-code',
    body: {
      phone: input.phone,
      purpose: input.purpose,
    },
  })
}

export async function registerWithPhone(input: {
  baseURL?: string
  phone: string
  password: string
  code: string
  name?: string
}): Promise<SecAILoginResponse> {
  return secAIFetchJSON<SecAILoginResponse>({
    baseURL: input.baseURL,
    method: 'POST',
    path: '/auth/register',
    body: {
      phone: input.phone,
      password: input.password,
      code: input.code,
      name: input.name || 'secai',
    },
  })
}

export async function resetPasswordWithPhone(input: {
  baseURL?: string
  phone: string
  password: string
  code: string
  name?: string
}): Promise<SecAILoginResponse> {
  return secAIFetchJSON<SecAILoginResponse>({
    baseURL: input.baseURL,
    method: 'POST',
    path: '/auth/reset-password',
    body: {
      phone: input.phone,
      password: input.password,
      code: input.code,
      name: input.name || 'secai',
    },
  })
}

export async function fetchBalance(
  config: SecAIConfig,
): Promise<SecAIBalanceResponse> {
  return secAIFetchJSON<SecAIBalanceResponse>({
    baseURL: config.base_url,
    apiKey: config.api_key,
    method: 'GET',
    path: '/v1/balance',
  })
}

export async function fetchUsage(
  config: SecAIConfig,
  limit: number,
): Promise<SecAIUsageResponse> {
  return secAIFetchJSON<SecAIUsageResponse>({
    baseURL: config.base_url,
    apiKey: config.api_key,
    method: 'GET',
    path: `/v1/usage?limit=${encodeURIComponent(String(limit))}`,
  })
}

async function loadDefaultSecAIConfig(): Promise<SecAIConfig | null> {
  const envConfig = loadDefaultSecAIConfigSync()
  const hasCallerProvidedKey =
    process.env.SECAI_API_KEY ||
    (process.env.SECAI_ACTIVE !== '1' && process.env.ANTHROPIC_API_KEY)
  if (hasCallerProvidedKey) {
    return envConfig
  }

  const defaults = loadSecAIEnvDefaults()
  if (!defaults.adminToken) {
    return envConfig
  }

  try {
    return await bootstrapDefaultSecAIKey(defaults)
  } catch {
    return envConfig
  }
}

function loadDefaultSecAIConfigSync(): SecAIConfig | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      base_url: gatewayURLFromAnthropicBaseURL(
        process.env.ANTHROPIC_BASE_URL || DEFAULT_SECAI_GATEWAY_URL,
      ),
      api_key: process.env.ANTHROPIC_API_KEY,
      model: normalizeSecAIModel(process.env.ANTHROPIC_MODEL),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  const defaults = loadSecAIEnvDefaults()
  if (!defaults.apiKey) {
    return null
  }
  return {
    base_url: defaults.gatewayURL,
    api_key: defaults.apiKey,
    model: DEFAULT_SECAI_MODEL,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function loadSecAIEnvDefaults(): SecAIEnvDefaults {
  const fileEnv = readEnvFile(getSecAIEnvFile())
  const gatewayURL = normalizeGatewayURL(
    process.env.SECAI_GATEWAY_URL ||
      gatewayURLFromAnthropicBaseURL(process.env.ANTHROPIC_BASE_URL) ||
      fileEnv.SECAI_GATEWAY_URL ||
      fileEnv.GATEWAY_BASE_URL ||
      DEFAULT_SECAI_GATEWAY_URL,
  )
  const firstGatewayKey = splitFirst(fileEnv.GATEWAY_API_KEYS)
  return {
    gatewayURL,
    apiKey:
      trimOrUndefined(process.env.SECAI_API_KEY) ||
      trimOrUndefined(process.env.ANTHROPIC_API_KEY) ||
      firstGatewayKey,
    adminToken:
      trimOrUndefined(process.env.SECAI_ADMIN_TOKEN) ||
      trimOrUndefined(fileEnv.ADMIN_TOKEN),
    bootstrapCreditCNY:
      trimOrUndefined(process.env.SECAI_BOOTSTRAP_CREDIT_CNY) ||
      DEFAULT_BOOTSTRAP_CREDIT_CNY,
  }
}

function getSecAIEnvFile(): string {
  return trimOrUndefined(process.env.SECAI_ENV_FILE) || DEFAULT_SECAI_ENV_FILE
}

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {}
  }
  const result: Record<string, string> = {}
  const raw = readFileSync(path, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(
      trimmed,
    )
    if (!match) {
      continue
    }
    result[match[1]!] = unquoteEnvValue(match[2]!)
  }
  return result
}

function unquoteEnvValue(raw: string): string {
  const value = raw.trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function splitFirst(value: string | undefined): string | undefined {
  return trimOrUndefined(value?.split(',')[0])
}

function trimOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

async function bootstrapDefaultSecAIKey(
  defaults: SecAIEnvDefaults,
): Promise<SecAIConfig> {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
  const user = await secAIAdminFetchJSON<{ id: number }>(defaults, {
    method: 'POST',
    path: '/admin/users',
    body: {
      username: `secai_cli_${suffix}`,
      nickname: 'SecAI CLI',
      email: `secai_cli_${suffix}@local.test`,
      status: 'active',
      password: `secai-${suffix}`,
    },
  })

  await secAIAdminFetchJSON(defaults, {
    method: 'POST',
    path: `/admin/users/${encodeURIComponent(String(user.id))}/credits`,
    body: {
      amount_cny: defaults.bootstrapCreditCNY,
      memo: 'secai default bootstrap',
    },
  })

  const key = await secAIAdminFetchJSON<{
    api_key: string
    record?: { prefix?: string }
  }>(defaults, {
    method: 'POST',
    path: `/admin/users/${encodeURIComponent(String(user.id))}/api-keys`,
    body: {
      name: 'secai-default',
    },
  })

  return saveSecAIConfig({
    baseURL: defaults.gatewayURL,
    apiKey: key.api_key,
    model: DEFAULT_SECAI_MODEL,
  })
}

async function secAIAdminFetchJSON<T>(
  defaults: SecAIEnvDefaults,
  input: {
    method: 'POST'
    path: string
    body: unknown
  },
): Promise<T> {
  const response = await fetch(defaults.gatewayURL + input.path, {
    method: input.method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Admin-Token': defaults.adminToken || '',
    },
    body: JSON.stringify(input.body),
  })
  const text = await response.text()
  const parsed = text ? tryParseJSON(text) : null
  if (!response.ok) {
    throw new SecAIRequestError(
      extractErrorMessage(parsed) || response.statusText || 'SecAI admin request failed',
      response.status,
      parseRetryAfter(response.headers.get('Retry-After')),
    )
  }
  return parsed as T
}

async function secAIFetchJSON<T>(input: {
  baseURL?: string
  apiKey?: string
  method: 'GET' | 'POST'
  path: string
  body?: unknown
}): Promise<T> {
  const url = normalizeGatewayURL(input.baseURL) + input.path
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  let body: string | undefined
  if (input.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(input.body)
  }
  if (input.apiKey) {
    headers.Authorization = `Bearer ${input.apiKey}`
  }

  const response = await fetch(url, {
    method: input.method,
    headers,
    body,
  })
  const text = await response.text()
  const parsed = text ? tryParseJSON(text) : null
  if (!response.ok) {
    throw new SecAIRequestError(
      extractErrorMessage(parsed) || response.statusText || 'SecAI request failed',
      response.status,
      parseRetryAfter(response.headers.get('Retry-After')),
    )
  }
  return parsed as T
}

function parseSecAIConfig(raw: string): SecAIConfig {
  const parsed = parseConfigJSON(raw)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('invalid SecAI config')
  }
  const config = parsed as Partial<SecAIConfig>
  if (!config.base_url || !config.api_key) {
    throw new Error('invalid SecAI config: base_url and api_key are required')
  }
  return {
    base_url: normalizeStoredGatewayURL(config.base_url),
    api_key: config.api_key,
    model: normalizeSecAIModel(config.model),
    user: parseSecAIUser(config.user),
    balance: parseSecAIConfigBalance(config.balance),
    created_at: config.created_at || new Date().toISOString(),
    updated_at: config.updated_at || new Date().toISOString(),
  }
}

function parseSecAIUser(value: unknown): SecAIUser | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const user = value as SecAIUser
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    email: user.email,
    phone: user.phone,
  }
}

function parseSecAIConfigBalance(value: unknown): SecAIConfigBalance | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const balance = value as SecAIConfigBalance
  return {
    user_id: balance.user_id,
    balance_micro_cny: balance.balance_micro_cny,
    balance_cny: balance.balance_cny,
  }
}

function parseConfigJSON(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('invalid SecAI config JSON')
  }
}

function tryParseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return { message: raw.trim() }
  }
}

function extractErrorMessage(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return ''
  }
  const payload = value as {
    error?: { message?: string }
    message?: string
  }
  return payload.error?.message || payload.message || ''
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  )
}
