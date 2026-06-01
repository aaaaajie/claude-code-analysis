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

产物输出到 `dist/artifacts/`。发布脚本会在每次 release build 前清理旧产物，避免上传历史平台包。

## 安装包

macOS / Linux 产物包含：

- `secai-<version>-<platform>-<arch>.tar.gz`
- `secai-<version>-<platform>-<arch>-installer.sh`

Windows 产物包含：

- `secai-<version>-windows-x64-installer.ps1`

## 发布注意

- 从干净 checkout 构建 release，不从脏工作区发布。
- 不要把 `.env`、真实 API key、账号 token、日志或本地缓存目录打进安装包。
- macOS 对外分发前需要 Developer ID 签名和 notarization。
- 发布前至少验证登录、余额、普通对话、工具调用、技能加载、退出重启缓存和 `/recharge`。
