export const DEFAULT_GRANT_FLAGS = {
  clipboardRead: false,
  clipboardWrite: false,
  systemKeyCombos: false,
}

export const API_RESIZE_PARAMS = {}

export function targetImageSize(): undefined {
  return undefined
}

export function buildComputerUseTools(): Array<{ name: string }> {
  return []
}

export function bindSessionContext(): () => never {
  return () => {
    throw new Error('Computer use is unavailable in this Node runtime build')
  }
}

export function getSentinelCategory(): string {
  return 'unknown'
}
