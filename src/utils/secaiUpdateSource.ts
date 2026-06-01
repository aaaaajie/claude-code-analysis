const DEFAULT_SECAI_GATEWAY_URL = 'https://ai.rzsec.cn'
const SECAI_UPDATE_PATH = '/downloads/secai-cli'

export function getSecAIUpdateBaseURL(): string {
  const explicit = normalizeBase(process.env.SECAI_UPDATE_BASE_URL)
  if (explicit) {
    return explicit
  }

  const gateway = normalizeGatewayURL(
    process.env.SECAI_GATEWAY_URL ||
      gatewayURLFromAnthropicBaseURL(process.env.ANTHROPIC_BASE_URL) ||
      DEFAULT_SECAI_GATEWAY_URL,
  )
  return `${gateway}${SECAI_UPDATE_PATH}`
}

function gatewayURLFromAnthropicBaseURL(raw: string | undefined): string {
  const base = normalizeBase(raw)
  if (!base) {
    return ''
  }
  return base.endsWith('/anthropic')
    ? base.slice(0, -'/anthropic'.length)
    : base
}

function normalizeGatewayURL(raw: string | undefined): string {
  return normalizeBase(raw) || DEFAULT_SECAI_GATEWAY_URL
}

function normalizeBase(raw: string | undefined): string {
  return (raw || '').trim().replace(/\/+$/, '')
}
