import type { Command } from '../../commands.js'

const web = {
  type: 'local-jsx',
  name: 'web-setup',
  description: '设置云端 SecAI（需要连接你的 GitHub 账号）',
  isEnabled: () => false,
  get isHidden() {
    return true
  },
  load: () => import('./remote-setup.js'),
} satisfies Command

export default web
