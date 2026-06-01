export function feature(name: string): boolean {
  const value =
    process.env[`CLAUDE_CODE_FEATURE_${name}`] ?? process.env[`FEATURE_${name}`]
  return value === '1' || value === 'true'
}
