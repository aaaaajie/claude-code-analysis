import {
  fetchBalance,
  formatSecAIAccountDisplay,
  loadSecAIConfig,
  type SecAIConfig,
} from '../../services/secai/client.js'
import type { LocalCommandCall } from '../../types/command.js'

const RECHARGE_CONTACT = '17759881711@163.com'

export const call: LocalCommandCall = async () => {
  return {
    type: 'text',
    value: await formatRechargeInfo(),
  }
}

export async function formatRechargeInfo(): Promise<string> {
  const config = await loadSecAIConfig()
  const lines = [
    'SecAI 充值中心',
    '',
    `状态：自动充值暂未开通`,
    `联系：${RECHARGE_CONTACT}`,
    `备注：请在邮件中注明手机号和充值金额。`,
  ]

  if (!config) {
    lines.splice(2, 0, '账号：未登录', '余额：-')
    lines.push('', '登录后可自动带出账号与余额。')
    return lines.join('\n')
  }

  lines.splice(
    2,
    0,
    `账号：${formatAccount(config)}`,
    `余额：${await formatBalance(config)}`,
  )
  return lines.join('\n')
}

async function formatBalance(config: SecAIConfig): Promise<string> {
  try {
    const balance = await fetchBalance(config)
    return `CNY ${balance.balance_cny}`
  } catch (error) {
    return `读取失败（${error instanceof Error ? error.message : '未知错误'}）`
  }
}

function formatAccount(config: SecAIConfig): string {
  return formatSecAIAccountDisplay(config.user) || '已登录'
}
