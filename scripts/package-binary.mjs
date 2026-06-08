import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chmod, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')
const packageRoot = join(distDir, 'package')
const artifactsDir = join(distDir, 'artifacts')
const updateRoot = join(distDir, 'update', 'secai-cli')
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

const platformNames = {
  darwin: 'macos',
  linux: 'linux',
  win32: 'windows',
}

const targetPlatform = process.env.SECAI_TARGET_PLATFORM || process.platform
const targetArch = process.env.SECAI_TARGET_ARCH || process.arch
const platformName = platformNames[targetPlatform]
if (!platformName) {
  throw new Error(`Unsupported platform: ${targetPlatform}`)
}

const binaryName = targetPlatform === 'win32' ? 'secai.exe' : 'secai'
const binaryPath = join(distDir, binaryName)
if (!existsSync(binaryPath)) {
  throw new Error(`Missing binary: ${binaryPath}. Run node scripts/build-binary.mjs first.`)
}

const target = `${platformName}-${targetArch}`
const packageName = `secai-${version}-${target}`
const packageDir = join(packageRoot, packageName)
const packageBinDir = join(packageDir, 'bin')

await rm(packageDir, { recursive: true, force: true })
mkdirSync(packageBinDir, { recursive: true })
mkdirSync(artifactsDir, { recursive: true })
mkdirSync(updateRoot, { recursive: true })

copyFileSync(binaryPath, join(packageBinDir, binaryName))
await chmod(join(packageBinDir, binaryName), 0o755)
writeUpdateFeedFiles()

if (targetPlatform === 'win32') {
  writePowerShellScript(join(packageDir, 'install.ps1'), windowsInstallScript())
  writePowerShellScript(join(packageDir, 'uninstall.ps1'), windowsUninstallScript())

  if (process.platform === 'win32') {
    const zipPath = join(artifactsDir, `${packageName}.zip`)
    await rm(zipPath, { force: true })
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `Compress-Archive -Force -Path '${packageDir}\\*' -DestinationPath '${zipPath}'`,
      ],
      { stdio: 'inherit' },
    )
    console.log(`\nCreated ${zipPath}`)
  }

  const installerPath = join(artifactsDir, `${packageName}-installer.ps1`)
  writePowerShellScript(installerPath, windowsSingleFileInstallScript())
  console.log(`Created ${installerPath}`)
} else {
  const installPath = join(packageDir, 'install.sh')
  const uninstallPath = join(packageDir, 'uninstall.sh')
  writeFileSync(installPath, unixInstallScript(), 'utf8')
  writeFileSync(uninstallPath, unixUninstallScript(), 'utf8')
  await chmod(installPath, 0o755)
  await chmod(uninstallPath, 0o755)

  const tarPath = join(artifactsDir, `${packageName}.tar.gz`)
  await rm(tarPath, { force: true })
  execFileSync('tar', ['-czf', tarPath, '-C', packageRoot, packageName], {
    stdio: 'inherit',
  })
  console.log(`\nCreated ${tarPath}`)

  const installerPath = join(artifactsDir, `${packageName}-installer.sh`)
  writeUnixSingleFileInstaller(installerPath, tarPath, packageName)
  await chmod(installerPath, 0o755)
  console.log(`Created ${installerPath}`)
}

function writePowerShellScript(filePath, contents) {
  writeFileSync(filePath, `\uFEFF${contents}`, 'utf8')
}

function writeUpdateFeedFiles() {
  const versionDir = join(updateRoot, version)
  const platformDir = join(versionDir, target)
  const updateBinaryPath = join(platformDir, binaryName)
  const compressedName = `${binaryName}.gz`
  const updateCompressedPath = join(platformDir, compressedName)
  mkdirSync(platformDir, { recursive: true })
  copyFileSync(binaryPath, updateBinaryPath)

  const binary = readFileSync(updateBinaryPath)
  const compressed = gzipSync(binary, { level: 9 })
  writeFileSync(updateCompressedPath, compressed)
  const platformInfo = {
    binary: binaryName,
    checksum: createHash('sha256').update(binary).digest('hex'),
    size: binary.length,
    download: compressedName,
    compression: 'gzip',
    downloadChecksum: createHash('sha256').update(compressed).digest('hex'),
    downloadSize: compressed.length,
  }
  const manifest = {
    version,
    platforms: {
      [target]: platformInfo,
    },
  }
  writeFileSync(
    join(versionDir, `manifest.${target}.json`),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  )
  writeFileSync(
    join(versionDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  )
  writeFileSync(join(updateRoot, 'latest'), `${version}\n`, 'utf8')
  writeFileSync(join(updateRoot, 'stable'), `${version}\n`, 'utf8')
  copyUpdateInstallScripts()
  console.log(`Created update feed files in ${updateRoot}`)
}

function copyUpdateInstallScripts() {
  const installSh = join(root, 'scripts', 'install.sh')
  const installPs1 = join(root, 'scripts', 'install.ps1')
  copyFileSync(installSh, join(updateRoot, 'install.sh'))
  copyFileSync(installPs1, join(updateRoot, 'install.ps1'))
  chmodSync(join(updateRoot, 'install.sh'), 0o755)
}

function writeUnixSingleFileInstaller(installerPath, tarPath, packageName) {
  const header = `#!/usr/bin/env sh
set -eu

TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t secai)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

ARCHIVE="$TMP_DIR/secai-package.tar.gz"
MARKER="__SECAI_ARCHIVE_BELOW__"
LINE="$(awk "/^$MARKER$/ { print NR + 1; exit 0; }" "$0")"
if [ -z "$LINE" ]; then
  printf '安装包损坏：找不到内置安装数据。\\n' >&2
  exit 1
fi

tail -n +"$LINE" "$0" > "$ARCHIVE"
tar -xzf "$ARCHIVE" -C "$TMP_DIR"
"$TMP_DIR/${packageName}/install.sh" "$@"
exit 0
__SECAI_ARCHIVE_BELOW__
`

  writeFileSync(
    installerPath,
    Buffer.concat([Buffer.from(header, 'utf8'), readFileSync(tarPath)]),
  )
}

function unixInstallScript() {
  return `#!/usr/bin/env sh
set -eu

PREFIX="$HOME/.secai"
if [ "\${1:-}" = "--prefix" ]; then
  PREFIX="\${2:?missing prefix after --prefix}"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$PREFIX/bin"
VERSION_DIR="$PREFIX/share/secai/versions"
VERSION_TARGET="$VERSION_DIR/${version}"
TARGET="$BIN_DIR/secai"

mkdir -p "$BIN_DIR" "$VERSION_DIR"
cp "$SCRIPT_DIR/bin/secai" "$VERSION_TARGET"
chmod 755 "$VERSION_TARGET"
ln -sfn "$VERSION_TARGET" "$TARGET"

case ":\${PATH:-}:" in
  *":$BIN_DIR:"*) PATH_READY=1 ;;
  *) PATH_READY=0 ;;
esac

if [ "$PATH_READY" = "0" ]; then
  SHELL_NAME="$(basename "\${SHELL:-sh}")"
  RC_FILE=""
  if [ "$SHELL_NAME" = "zsh" ]; then
    RC_FILE="$HOME/.zshrc"
  elif [ "$SHELL_NAME" = "bash" ]; then
    RC_FILE="$HOME/.bashrc"
  fi

  if [ -n "$RC_FILE" ]; then
    LINE="export PATH=\\"$BIN_DIR:\\$PATH\\""
    touch "$RC_FILE"
    if ! grep -F "$LINE" "$RC_FILE" >/dev/null 2>&1; then
      printf '\\n# SecAI CLI\\n%s\\n' "$LINE" >> "$RC_FILE"
    fi
    printf '已安装 SecAI：%s\\n已更新 %s。请重新打开终端，或运行：\\n  export PATH="%s:$PATH"\\n' "$TARGET" "$RC_FILE" "$BIN_DIR"
  else
    printf '已安装 SecAI：%s\\n请把以下目录加入 PATH：\\n  %s\\n' "$TARGET" "$BIN_DIR"
  fi
else
  printf '已安装 SecAI：%s\\n' "$TARGET"
fi

"$TARGET" --version
`
}

function unixUninstallScript() {
  return `#!/usr/bin/env sh
set -eu

PREFIX="$HOME/.secai"
if [ "\${1:-}" = "--prefix" ]; then
  PREFIX="\${2:?missing prefix after --prefix}"
fi

TARGET="$PREFIX/bin/secai"
VERSION_DIR="$PREFIX/share/secai/versions"
if [ -f "$TARGET" ]; then
  rm "$TARGET"
  printf '已删除 SecAI：%s\\n' "$TARGET"
else
  printf '未找到 SecAI：%s\\n' "$TARGET"
fi
if [ -d "$VERSION_DIR" ]; then
  rm -rf "$VERSION_DIR"
  printf '已删除 SecAI 版本目录：%s\\n' "$VERSION_DIR"
fi
`
}

function windowsInstallScript() {
  return [
    'param(',
    '  [string]$InstallDir = "$env:LOCALAPPDATA\\SecAI\\bin"',
    ')',
    '',
    '$ErrorActionPreference = "Stop"',
    '$target = Join-Path $InstallDir "secai.exe"',
    'New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null',
    'Copy-Item -Force -Path (Join-Path $PSScriptRoot "bin\\secai.exe") -Destination $target',
    '',
    '$userPath = [Environment]::GetEnvironmentVariable("Path", "User")',
    '$parts = @()',
    'if ($userPath) {',
    '  $parts = $userPath -split ";" | Where-Object { $_ }',
    '}',
    '',
    'if ($parts -notcontains $InstallDir) {',
    '  [Environment]::SetEnvironmentVariable("Path", (($parts + $InstallDir) -join ";"), "User")',
    '  Write-Host "Installed SecAI: $target"',
    '  Write-Host "Updated user PATH. Reopen PowerShell, or run this in the current session:"',
    '  Write-Host "  `$env:Path = `"$InstallDir;`$env:Path`""',
    '} else {',
    '  Write-Host "Installed SecAI: $target"',
    '}',
    '',
    '& $target --version',
    '',
  ].join('\n')
}

function windowsUninstallScript() {
  return [
    'param(',
    '  [string]$InstallDir = "$env:LOCALAPPDATA\\SecAI\\bin"',
    ')',
    '',
    '$ErrorActionPreference = "Stop"',
    '$target = Join-Path $InstallDir "secai.exe"',
    'if (Test-Path $target) {',
    '  Remove-Item -Force $target',
    '  Write-Host "Removed SecAI: $target"',
    '} else {',
    '  Write-Host "SecAI was not found: $target"',
    '}',
    '',
    '$userPath = [Environment]::GetEnvironmentVariable("Path", "User")',
    'if ($userPath) {',
    '  $parts = $userPath -split ";" | Where-Object { $_ -and $_ -ne $InstallDir }',
    '  [Environment]::SetEnvironmentVariable("Path", ($parts -join ";"), "User")',
    '}',
    '',
  ].join('\n')
}

function windowsSingleFileInstallScript() {
  const payload = readFileSync(binaryPath).toString('base64')
  return [
    'param(',
    '  [string]$InstallDir = "$env:LOCALAPPDATA\\SecAI\\bin"',
    ')',
    '',
    '$ErrorActionPreference = "Stop"',
    '$target = Join-Path $InstallDir "secai.exe"',
    'New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null',
    '',
    "$payload = @'",
    payload,
    "'@",
    '[IO.File]::WriteAllBytes($target, [Convert]::FromBase64String($payload))',
    '',
    '$userPath = [Environment]::GetEnvironmentVariable("Path", "User")',
    '$parts = @()',
    'if ($userPath) {',
    '  $parts = $userPath -split ";" | Where-Object { $_ }',
    '}',
    '',
    'if ($parts -notcontains $InstallDir) {',
    '  [Environment]::SetEnvironmentVariable("Path", (($parts + $InstallDir) -join ";"), "User")',
    '  Write-Host "Installed SecAI: $target"',
    '  Write-Host "Updated user PATH. Reopen PowerShell, or run this in the current session:"',
    '  Write-Host "  `$env:Path = `"$InstallDir;`$env:Path`""',
    '} else {',
    '  Write-Host "Installed SecAI: $target"',
    '}',
    '',
    '& $target --version',
    '',
  ].join('\n')
}
