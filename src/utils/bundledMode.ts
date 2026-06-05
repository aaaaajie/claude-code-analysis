/**
 * Detects if the current runtime is Bun.
 * Returns true when:
 * - Running a JS file via the `bun` command
 * - Running a Bun-compiled standalone executable
 */
export function isRunningWithBun(): boolean {
  // https://bun.com/guides/util/detect-bun
  return process.versions.bun !== undefined
}

function isSecAIBinary(path: string | undefined): boolean {
  const file = path?.split(/[\\/]/).pop()?.toLowerCase()
  return file === 'secai' || file === 'secai.exe'
}

/**
 * Detects if running as a standalone executable.
 */
export function isInBundledMode(): boolean {
  return (
    (typeof Bun !== 'undefined' &&
      Array.isArray(Bun.embeddedFiles) &&
      Bun.embeddedFiles.length > 0) ||
    isSecAIBinary(process.execPath) ||
    isSecAIBinary(process.argv[0])
  )
}
