const ACTIVITY_PREFIXES: Array<[RegExp, string]> = [
  [/^Source-sink\b/i, '源汇追踪'],
  [/^Source sink\b/i, '源汇追踪'],
  [/^Tracing\b/i, '追踪'],
  [/^Auditing\b/i, '审计'],
  [/^Inspecting\b/i, '检查'],
  [/^Enumerating\b/i, '枚举'],
  [/^Mapping\b/i, '梳理'],
  [/^Probing\b/i, '探测'],
  [/^Scanning\b/i, '扫描'],
  [/^Searching\b/i, '搜索'],
  [/^Reading\b/i, '读取'],
  [/^Running\b/i, '运行'],
  [/^Checking\b/i, '检查'],
  [/^Analyzing\b/i, '分析'],
  [/^Reviewing\b/i, '审查'],
  [/^Testing\b/i, '测试'],
  [/^Building\b/i, '构建'],
  [/^Fixing\b/i, '修复'],
  [/^Updating\b/i, '更新'],
  [/^Creating\b/i, '创建'],
  [/^Generating\b/i, '生成'],
  [/^Validating\b/i, '验证'],
  [/^Verifying\b/i, '验证'],
  [/^Installing\b/i, '安装'],
  [/^Loading\b/i, '加载'],
  [/^Preparing\b/i, '准备'],
]

export function localizeActivityText(text: string): string {
  for (const [pattern, replacement] of ACTIVITY_PREFIXES) {
    if (pattern.test(text)) {
      return text.replace(pattern, replacement).trim()
    }
  }
  return text
}
