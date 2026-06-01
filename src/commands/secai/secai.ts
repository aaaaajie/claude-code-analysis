import type { LocalCommandCall } from '../../types/command.js'
import {
  clearSecAIConfig,
  DEFAULT_SECAI_MODEL,
  fetchBalance,
  fetchUsage,
  formatSecAIAccountDisplay,
  getSecAIConfigPath,
  loadSecAIConfig,
  loginWithPassword,
  normalizeGatewayURL,
  registerWithPhone,
  resetPasswordWithPhone,
  saveSecAIConfig,
  SecAIRequestError,
  sendAuthCode,
  type SecAIConfig,
  type SecAILoginResponse,
} from '../../services/secai/client.js'
import { formatRechargeInfo } from '../recharge/recharge.js'

export const call: LocalCommandCall = async args => {
  const parsed = parseArgs(args)
  const action = parsed.positionals[0] || 'status'

  try {
    switch (action) {
      case 'login':
        return text(await login(parsed))
      case 'use':
        return text(await useAPIKey(parsed))
      case 'send-code':
        return text(await sendCode(parsed))
      case 'register':
        return text(await register(parsed))
      case 'reset-password':
        return text(await resetPassword(parsed))
      case 'balance':
        return text(await balance())
      case 'usage':
        return text(await usage(parsed))
      case 'recharge':
        return text(await formatRechargeInfo())
      case 'status':
        return text(await status())
      case 'logout':
        return text(await logout())
      case 'help':
      case '--help':
      case '-h':
        return text(help())
      default:
        return text(`未知 SecAI 命令：${action}\n\n${help()}`)
    }
  } catch (error) {
    return text(formatError(error))
  }
}

async function login(parsed: ParsedArgs): Promise<string> {
  const baseURL = gatewayURL(parsed)
  const account = required(parsed, 'account')
  const password = required(parsed, 'password')
  const response = await loginWithPassword({
    baseURL,
    account,
    password,
  })
  return saveLogin(baseURL, response, account)
}

async function useAPIKey(parsed: ParsedArgs): Promise<string> {
  const baseURL = gatewayURL(parsed)
  const apiKey = required(parsed, 'api-key')
  const config = await saveSecAIConfig({
    baseURL,
    apiKey,
    model: option(parsed, 'model') || DEFAULT_SECAI_MODEL,
  })
  const bal = await fetchBalance(config)
  return [
    'SecAI 已配置。',
    `模型：${config.model || DEFAULT_SECAI_MODEL}`,
    `余额：${bal.balance_cny} CNY`,
  ].join('\n')
}

async function sendCode(parsed: ParsedArgs): Promise<string> {
  const response = await sendAuthCode({
    baseURL: gatewayURL(parsed),
    phone: required(parsed, 'phone'),
    purpose:
      option(parsed, 'purpose') === 'reset_password'
        ? 'reset_password'
        : 'register',
  })
  return [
    `验证码已发送，${response.expires_in_seconds} 秒后过期。`,
    response.dev_code
      ? `开发验证码：${response.dev_code}`
      : '短信服务商已接受请求。',
  ].join('\n')
}

async function register(parsed: ParsedArgs): Promise<string> {
  const baseURL = gatewayURL(parsed)
  const response = await registerWithPhone({
    baseURL,
    phone: required(parsed, 'phone'),
    password: required(parsed, 'password'),
    code: required(parsed, 'code'),
  })
  return saveLogin(baseURL, response, required(parsed, 'phone'))
}

async function resetPassword(parsed: ParsedArgs): Promise<string> {
  const baseURL = gatewayURL(parsed)
  const phone = required(parsed, 'phone')
  const response = await resetPasswordWithPhone({
    baseURL,
    phone,
    password: required(parsed, 'password'),
    code: required(parsed, 'code'),
  })
  return saveLogin(baseURL, response, phone)
}

async function balance(): Promise<string> {
  const config = await requiredConfig()
  const response = await fetchBalance(config)
  const lines = [
    `余额：${response.balance_cny} CNY`,
    `用户 ID：${response.user_id}`,
  ]
  if (response.last_usage) {
    lines.push(
      `最近用量：${response.last_usage.model_alias} - ${response.last_usage.total_tokens} tokens - ${microCNY(response.last_usage.revenue_micro_cny)} CNY`,
    )
  }
  return lines.join('\n')
}

async function usage(parsed: ParsedArgs): Promise<string> {
  const config = await requiredConfig()
  const limit = Number.parseInt(option(parsed, 'limit') || '5', 10)
  const response = await fetchUsage(config, Number.isFinite(limit) ? limit : 5)
  if (response.data.length === 0) {
    return '没有 SecAI 用量记录。'
  }
  return response.data
    .map(record =>
      [
        `#${record.id}`,
        record.model_alias,
        `${record.total_tokens} tokens`,
        `${microCNY(record.revenue_micro_cny)} CNY`,
        record.status_code === 0 ? '待处理' : String(record.status_code),
      ].join(' - '),
    )
    .join('\n')
}

async function status(): Promise<string> {
  const config = await loadSecAIConfig()
  if (!config) {
    return [
      'SecAI 尚未配置。',
      `配置路径：${getSecAIConfigPath()}`,
      '运行：/secai login --account <phone> --password <password>',
    ].join('\n')
  }
  return [
    'SecAI 已配置。',
    `账号：${formatSecAIAccountDisplay(config.user) || '已登录'}`,
    `模型：${config.model || DEFAULT_SECAI_MODEL}`,
    `API key：${maskKey(config.api_key)}`,
    `配置路径：${getSecAIConfigPath()}`,
  ].join('\n')
}

async function logout(): Promise<string> {
  await clearSecAIConfig()
  return '已移除 SecAI 本地配置。'
}

async function saveLogin(
  baseURL: string,
  response: SecAILoginResponse,
  account?: string,
): Promise<string> {
  const config = await saveSecAIConfig({
    baseURL,
    apiKey: response.api_key,
    model: DEFAULT_SECAI_MODEL,
    user: response.user || (account ? userFromAccount(account) : undefined),
    balance: response.balance,
  })
  const lines = [
    '已登录 SecAI。',
    `模型：${config.model || DEFAULT_SECAI_MODEL}`,
    `API key：${maskKey(config.api_key)}`,
  ]
  if (response.user) {
    lines.push(`账号：${formatSecAIAccountDisplay(response.user, account) || '已登录'}`)
  } else if (account) {
    lines.push(`账号：${formatSecAIAccountDisplay(undefined, account)}`)
  }
  if (response.balance) {
    lines.push(`余额：${microCNY(response.balance.balance_micro_cny)} CNY`)
  }
  return lines.join('\n')
}

function userFromAccount(account: string) {
  return account.includes('@') ? { email: account } : { phone: account }
}

async function requiredConfig(): Promise<SecAIConfig> {
  const config = await loadSecAIConfig()
  if (!config) {
    throw new Error('SecAI 尚未配置。请先运行 /secai login。')
  }
  return config
}

function help(): string {
  return [
    'SecAI 命令：',
    '/secai login --account <phone> --password <password>',
    `/secai send-code --phone <phone> --purpose register`,
    `/secai register --phone <phone> --password <password> --code <code>`,
    `/secai reset-password --phone <phone> --password <password> --code <code>`,
    '/secai use --api-key <gw_xxx>',
    '/secai balance',
    '/secai usage --limit 5',
    '/secai recharge',
    '/secai status',
    '/secai logout',
  ].join('\n')
}

type ParsedArgs = {
  positionals: string[]
  options: Record<string, string>
}

function parseArgs(args: string): ParsedArgs {
  const tokens = tokenize(args)
  const positionals: string[] = []
  const options: Record<string, string> = {}
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }
    const key = token.slice(2)
    const next = tokens[i + 1]
    if (!next || next.startsWith('--')) {
      options[key] = 'true'
      continue
    }
    options[key] = next
    i++
  }
  return { positionals, options }
}

function tokenize(input: string): string[] {
  const tokens: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(input))) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? '')
  }
  return tokens
}

function gatewayURL(parsed: ParsedArgs): string {
  return normalizeGatewayURL(option(parsed, 'url') || process.env.SECAI_GATEWAY_URL)
}

function option(parsed: ParsedArgs, name: string): string | undefined {
  return parsed.options[name]?.trim()
}

function required(parsed: ParsedArgs, name: string): string {
  const value = option(parsed, name)
  if (!value) {
    throw new Error(`必须提供 --${name}`)
  }
  return value
}

function maskKey(key: string): string {
  if (key.length <= 10) {
    return '***'
  }
  return `${key.slice(0, 5)}...${key.slice(-4)}`
}

function microCNY(value: number): string {
  return (value / 1_000_000).toFixed(6).replace(/\.?0+$/, '')
}

function formatError(error: unknown): string {
  if (error instanceof SecAIRequestError) {
    const suffix = error.retryAfter
      ? ` ${error.retryAfter} 秒后重试。`
      : ''
    return `SecAI 请求失败（${error.status}）：${error.message}。${suffix}`
  }
  if (error instanceof Error) {
    return `SecAI 错误：${error.message}`
  }
  return 'SecAI 错误：未知错误'
}

function text(value: string) {
  return { type: 'text' as const, value }
}
