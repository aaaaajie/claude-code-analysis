import type { Command } from '../../commands.js'

const installGitHubApp = {
  type: 'local-jsx',
  name: 'install-github-app',
  description: '为仓库设置 GitHub Actions',
  isEnabled: () => false,
  isHidden: true,
  load: () => import('./install-github-app.js'),
} satisfies Command

export default installGitHubApp
