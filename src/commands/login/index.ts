import type { Command } from '../../commands.js'
export default () =>
  ({
    type: 'local-jsx',
    name: 'login',
    description: '登录 SecAI 账号',
    isEnabled: () => false,
    isHidden: true,
    load: () => import('./login.js'),
  }) satisfies Command
