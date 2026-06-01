import {
  getModelUsage,
  getTotalAPIDuration,
  getTotalCacheCreationInputTokens,
  getTotalCacheReadInputTokens,
  getTotalDuration,
  getTotalInputTokens,
  getTotalLinesAdded,
  getTotalLinesRemoved,
  getTotalOutputTokens,
} from '../../cost-tracker.js'
import {
  fetchBalance,
  fetchUsage,
  loadSecAIConfig,
  type SecAIBalanceResponse,
  type SecAIUsageRecord,
} from '../../services/secai/client.js'
import type { LocalCommandCall } from '../../types/command.js'
import { formatDuration, formatNumber } from '../../utils/format.js'

const RECENT_USAGE_LIMIT = 5

export const call: LocalCommandCall = async () => {
  const config = await loadSecAIConfig()
  const localSummary = formatLocalSessionSummary()

  if (!config) {
    return {
      type: 'text',
      value: [
        'SecAI 尚未配置，无法读取账号余额和用量。',
        '运行 /secai login --account <phone> --password <password> 后可查看真实费用数据。',
        '',
        localSummary,
      ].join('\n'),
    }
  }

  try {
    const [balance, usage] = await Promise.all([
      fetchBalance(config),
      fetchUsage(config, RECENT_USAGE_LIMIT),
    ])
    return {
      type: 'text',
      value: [
        formatSecAICostSummary(balance, usage.data),
        '',
        localSummary,
      ].join('\n'),
    }
  } catch (error) {
    return {
      type: 'text',
      value: [
        `SecAI 费用数据读取失败：${formatError(error)}`,
        '',
        localSummary,
      ].join('\n'),
    }
  }
}

function formatSecAICostSummary(
  balance: SecAIBalanceResponse,
  records: SecAIUsageRecord[],
): string {
  const lines = [
    'SecAI 费用概览',
    `余额：${balance.balance_cny} CNY`,
    `用户 ID：${balance.user_id}`,
  ]

  if (records.length === 0) {
    lines.push('最近用量：暂无记录')
    return lines.join('\n')
  }

  const totalTokens = records.reduce((sum, record) => sum + record.total_tokens, 0)
  const totalMicroCNY = records.reduce(
    (sum, record) => sum + record.revenue_micro_cny,
    0,
  )
  lines.push(
    `最近 ${records.length} 条合计：${formatNumber(totalTokens)} tokens，${microCNY(totalMicroCNY)} CNY`,
    '最近用量：',
  )

  for (const record of records) {
    lines.push(
      [
        `#${record.id}`,
        record.model_alias,
        `${formatNumber(record.total_tokens)} tokens`,
        `${microCNY(record.revenue_micro_cny)} CNY`,
        formatUsageStatus(record.status_code),
      ].join(' - '),
    )
  }

  return lines.join('\n')
}

function formatLocalSessionSummary(): string {
  const lines = [
    '本地会话统计',
    `API 耗时：${formatDuration(getTotalAPIDuration())}`,
    `会话耗时：${formatDuration(getTotalDuration())}`,
    `Token：输入 ${formatNumber(getTotalInputTokens())}，输出 ${formatNumber(getTotalOutputTokens())}，缓存读取 ${formatNumber(getTotalCacheReadInputTokens())}，缓存写入 ${formatNumber(getTotalCacheCreationInputTokens())}`,
    `代码变更：新增 ${getTotalLinesAdded()} 行，删除 ${getTotalLinesRemoved()} 行`,
  ]

  const modelUsage = Object.entries(getModelUsage())
  if (modelUsage.length === 0) {
    lines.push('模型用量：暂无本地统计')
    return lines.join('\n')
  }

  lines.push('模型用量：')
  for (const [model, usage] of modelUsage) {
    lines.push(
      `  ${model}: 输入 ${formatNumber(usage.inputTokens)}，输出 ${formatNumber(usage.outputTokens)}，缓存读取 ${formatNumber(usage.cacheReadInputTokens)}，缓存写入 ${formatNumber(usage.cacheCreationInputTokens)}`,
    )
  }
  return lines.join('\n')
}

function microCNY(value: number): string {
  return (value / 1_000_000).toFixed(6).replace(/\.?0+$/, '')
}

function formatUsageStatus(statusCode: number): string {
  return statusCode === 0 ? '待处理' : `状态 ${statusCode}`
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误'
}
