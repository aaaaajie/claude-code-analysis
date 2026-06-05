# SecAI CLI

SecAI CLI 是面向本地研发场景的命令行智能体客户端，默认连接 SecAI Gateway，并使用内置的 DeepSeek 模型配置、账号登录、余额计费、技能和工具调用能力。

## 本地开发

```bash
npm ci
npm run build
node dist/claude.mjs --version
node dist/claude.mjs
```

非交互式冒烟：

```bash
node dist/claude.mjs -p '只回复两个字：成功' --max-turns 1 --output-format text
```

## 打包

```bash
SECAI_SKIP_BINARY_SMOKE=1 node scripts/build-release.mjs
```

安装包输出到 `dist/artifacts/`，自动更新源输出到 `dist/update/secai-cli/`。发布脚本会在每次 release build 前清理旧产物，避免上传历史平台包和旧更新源。

## 安装包

在线安装：

```bash
curl -fsSL https://ai.rzsec.cn/install.sh | sh
```

```powershell
irm https://ai.rzsec.cn/install.ps1 | iex
```

macOS / Linux 产物包含：

- `secai-<version>-<platform>-<arch>.tar.gz`
- `secai-<version>-<platform>-<arch>-installer.sh`

Windows 产物包含：

- `secai-<version>-windows-<arch>.zip`
- `secai-<version>-windows-<arch>-installer.ps1`

## 自动更新源

客户端默认从 SecAI Gateway 读取更新：

```text
https://ai.rzsec.cn/downloads/secai-cli/latest
https://ai.rzsec.cn/downloads/secai-cli/stable
https://ai.rzsec.cn/install.sh
https://ai.rzsec.cn/install.ps1
https://ai.rzsec.cn/downloads/secai-cli/install.sh
https://ai.rzsec.cn/downloads/secai-cli/install.ps1
https://ai.rzsec.cn/downloads/secai-cli/<version>/manifest.json
https://ai.rzsec.cn/downloads/secai-cli/<version>/<platform>/secai
```

部署时把 `dist/update/secai-cli/` 同步到网关服务器的 `./downloads/secai-cli/`。如果多个平台分开打包，先把各平台生成的 `dist/update/secai-cli/` 合并到同一目录，再运行：

```bash
node scripts/merge-update-manifest.mjs <version>
```

客户端可用 `SECAI_UPDATE_BASE_URL` 临时覆盖更新源。

## 发布注意

- 从干净 checkout 构建 release，不从脏工作区发布。
- 不要把 `.env`、真实 API key、账号 token、日志或本地缓存目录打进安装包。
- macOS 对外分发前需要 Developer ID 签名和 notarization。
- 上传更新源后检查 `latest`、`stable`、`manifest.json` 和平台二进制都能通过网关访问。
- 发布前至少验证登录、余额、普通对话、工具调用、技能加载、退出重启缓存和 `/recharge`。
