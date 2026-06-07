const DEFAULT_SECAI_UPDATE_BASE_URL =
  'https://ai.rzsec.cn/downloads/secai-cli'

export function getSecAIUpdateBaseURL(): string {
  const explicit = normalizeBase(process.env.SECAI_UPDATE_BASE_URL)
  return explicit || DEFAULT_SECAI_UPDATE_BASE_URL
}

function normalizeBase(raw: string | undefined): string {
  return (raw || '').trim().replace(/\/+$/, '')
}
