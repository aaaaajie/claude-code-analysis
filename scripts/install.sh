#!/usr/bin/env sh
set -eu

BASE_URL="${SECAI_UPDATE_BASE_URL:-https://ai.rzsec.cn/downloads/secai-cli}"
CHANNEL="${SECAI_UPDATE_CHANNEL:-latest}"
VERSION=""
INSTALL_DIR="${SECAI_INSTALL_DIR:-$HOME/.secai/bin}"

if [ -t 1 ]; then
  BOLD="$(printf '\033[1m')"
  DIM="$(printf '\033[2m')"
  GREEN="$(printf '\033[32m')"
  YELLOW="$(printf '\033[33m')"
  RED="$(printf '\033[31m')"
  RESET="$(printf '\033[0m')"
else
  BOLD=""
  DIM=""
  GREEN=""
  YELLOW=""
  RED=""
  RESET=""
fi

info() {
  printf '%s\n' "$*"
}

rule() {
  printf '%s\n' '────────────────────────────────────────'
}

header() {
  info ""
  rule
  printf '%sSecAI CLI Installer%s\n' "$BOLD" "$RESET"
  info "${DIM}Secure install with verified downloads / 安全下载并校验安装包${RESET}"
  rule
  info ""
}

step() {
  printf '\n%s==>%s %s\n' "$BOLD" "$RESET" "$*"
}

ok() {
  printf '%sOK%s %s\n' "$GREEN" "$RESET" "$*"
}

warn() {
  printf '%sWARN%s %s\n' "$YELLOW" "$RESET" "$*"
}

fail() {
  printf '%sERROR%s %s\n' "$RED" "$RESET" "$*" >&2
  exit 1
}

human_size() {
  awk -v bytes="$1" 'BEGIN {
    split("B KiB MiB GiB", units, " ")
    value = bytes + 0
    unit = 1
    while (value >= 1024 && unit < 4) {
      value = value / 1024
      unit++
    }
    if (unit == 1) {
      printf "%d %s", value, units[unit]
    } else {
      printf "%.2f %s", value, units[unit]
    }
  }'
}

usage() {
  cat <<'EOF'
SecAI CLI installer

Usage:
  curl -fsSL https://ai.rzsec.cn/install.sh | sh

Options:
  --channel latest|stable
  --version <version>
  --install-dir <dir>
  --base-url <url>
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --channel)
      CHANNEL="${2:?missing value after --channel}"
      shift 2
      ;;
    --version)
      VERSION="${2:?missing value after --version}"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="${2:?missing value after --install-dir}"
      shift 2
      ;;
    --base-url)
      BASE_URL="${2:?missing value after --base-url}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

BASE_URL="$(printf '%s' "$BASE_URL" | sed 's:/*$::')"

have() {
  command -v "$1" >/dev/null 2>&1
}

fetch_text() {
  url="$1"
  if have curl; then
    curl -fsSL "$url"
  elif have wget; then
    wget -qO- "$url"
  else
    fail "curl or wget is required."
  fi
}

download_file() {
  url="$1"
  output="$2"
  show_progress="${3:-0}"
  if have curl; then
    if [ "$show_progress" = "1" ] && [ -t 2 ]; then
      curl -fL --progress-bar "$url" -o "$output"
    else
      curl -fsSL "$url" -o "$output"
    fi
  elif have wget; then
    if [ "$show_progress" = "1" ] && [ -t 2 ]; then
      wget -q --show-progress -O "$output" "$url"
    else
      wget -qO "$output" "$url"
    fi
  else
    fail "curl or wget is required."
  fi
}

detect_platform() {
  os="$(uname -s 2>/dev/null || printf unknown)"
  arch="$(uname -m 2>/dev/null || printf unknown)"

  case "$os" in
    Darwin)
      case "$arch" in
        arm64|aarch64) printf 'macos-arm64' ;;
        x86_64|amd64) printf 'macos-x64' ;;
        *) unsupported "macos-$arch" ;;
      esac
      ;;
    Linux)
      case "$arch" in
        x86_64|amd64) printf 'linux-x64' ;;
        arm64|aarch64) printf 'linux-arm64' ;;
        *) unsupported "linux-$arch" ;;
      esac
      ;;
    MINGW*|MSYS*|CYGWIN*)
      fail "Please use PowerShell installer on Windows: irm https://ai.rzsec.cn/install.ps1 | iex"
      ;;
    *)
      unsupported "$os-$arch"
      ;;
  esac
}

unsupported() {
  fail "Unsupported platform / 不支持的平台: $1. Supported platforms: windows-x64, windows-arm64, macos-arm64, macos-x64, linux-x64, linux-arm64"
}

extract_string() {
  key="$1"
  sed -n 's/.*"'"$key"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
}

extract_number() {
  key="$1"
  sed -n 's/.*"'"$key"'"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -n 1
}

sha256_file() {
  file="$1"
  if have sha256sum; then
    sha256sum "$file" | awk '{print $1}'
  elif have shasum; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    fail "sha256sum or shasum is required."
  fi
}

add_path_hint() {
  bin_dir="$1"
  case ":${PATH:-}:" in
    *":$bin_dir:"*) return 0 ;;
  esac

  shell_name="$(basename "${SHELL:-sh}")"
  rc_file=""
  if [ "$shell_name" = "zsh" ]; then
    rc_file="$HOME/.zshrc"
  elif [ "$shell_name" = "bash" ]; then
    rc_file="$HOME/.bashrc"
  else
    rc_file="$HOME/.profile"
  fi

  line="export PATH=\"$bin_dir:\$PATH\""
  touch "$rc_file"
  if ! grep -F "$line" "$rc_file" >/dev/null 2>&1; then
    printf '\n# SecAI CLI\n%s\n' "$line" >> "$rc_file"
    ok "PATH updated: $rc_file"
  else
    ok "PATH already configured / PATH 已配置: $rc_file"
  fi

  warn "Restart your terminal, or run / 重新打开终端，或执行: export PATH=\"$bin_dir:\$PATH\""
}

header

PLATFORM="$(detect_platform)"
if [ -z "$VERSION" ]; then
  step "Resolving latest version / 获取最新版本 ($CHANNEL)"
  VERSION="$(fetch_text "$BASE_URL/$CHANNEL" | tr -d '\r\n ')"
fi

if [ -z "$VERSION" ]; then
  fail "Unable to resolve SecAI version / 无法获取 SecAI 版本: $BASE_URL/$CHANNEL"
fi

TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t secai)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

MANIFEST="$TMP_DIR/manifest.json"
BINARY_TMP="$TMP_DIR/secai.download"
PACKAGE_TMP="$TMP_DIR/secai.package"
step "Downloading manifest / 下载版本清单"
download_file "$BASE_URL/$VERSION/manifest.json" "$MANIFEST"

PLATFORM_BLOCK="$(awk -v platform="\"$PLATFORM\"" '
  $0 ~ platform { found = 1 }
  found { print }
  found && $0 ~ /^[[:space:]]*}/ { exit }
' "$MANIFEST")"

if [ -z "$PLATFORM_BLOCK" ]; then
  unsupported "$PLATFORM"
fi

BINARY_NAME="$(printf '%s\n' "$PLATFORM_BLOCK" | extract_string binary)"
EXPECTED_SHA="$(printf '%s\n' "$PLATFORM_BLOCK" | extract_string checksum)"
EXPECTED_SIZE="$(printf '%s\n' "$PLATFORM_BLOCK" | extract_number size)"
DOWNLOAD_NAME="$(printf '%s\n' "$PLATFORM_BLOCK" | extract_string download)"
COMPRESSION="$(printf '%s\n' "$PLATFORM_BLOCK" | extract_string compression)"
DOWNLOAD_SHA="$(printf '%s\n' "$PLATFORM_BLOCK" | extract_string downloadChecksum)"
DOWNLOAD_SIZE="$(printf '%s\n' "$PLATFORM_BLOCK" | extract_number downloadSize)"

if [ -z "$BINARY_NAME" ] || [ -z "$EXPECTED_SHA" ] || [ -z "$EXPECTED_SIZE" ] || [ -z "$DOWNLOAD_NAME" ] || [ -z "$DOWNLOAD_SHA" ] || [ -z "$DOWNLOAD_SIZE" ] || [ "$COMPRESSION" != "gzip" ]; then
  fail "Invalid manifest / 版本清单无效: $VERSION $PLATFORM. Gzip download metadata is required."
fi

if ! have gzip && ! have gunzip; then
  fail "gzip or gunzip is required to install SecAI / 安装 SecAI 需要 gzip 或 gunzip。"
fi

rule
printf '  %-12s %s\n' '版本' "$VERSION"
printf '  %-12s %s\n' '平台' "$PLATFORM"
printf '  %-12s %s\n' '下载大小' "$(human_size "$DOWNLOAD_SIZE")"
printf '  %-12s %s\n' '安装目录' "$INSTALL_DIR"
rule

step "Downloading SecAI / 下载 SecAI"
download_file "$BASE_URL/$VERSION/$PLATFORM/$DOWNLOAD_NAME" "$PACKAGE_TMP" 1

ACTUAL_DOWNLOAD_SIZE="$(wc -c < "$PACKAGE_TMP" | tr -d ' ')"
if [ "$ACTUAL_DOWNLOAD_SIZE" != "$DOWNLOAD_SIZE" ]; then
  fail "Compressed size mismatch / 压缩包大小不匹配: expected $DOWNLOAD_SIZE, got $ACTUAL_DOWNLOAD_SIZE."
fi

step "Verifying compressed package / 校验压缩包"
ACTUAL_DOWNLOAD_SHA="$(sha256_file "$PACKAGE_TMP")"
if [ "$ACTUAL_DOWNLOAD_SHA" != "$DOWNLOAD_SHA" ]; then
  fail "Compressed checksum mismatch / 压缩包校验失败: expected $DOWNLOAD_SHA, got $ACTUAL_DOWNLOAD_SHA."
fi
ok "Compressed package verified / 压缩包校验通过"

step "Unpacking binary / 解压程序"
if have gzip; then
  gzip -dc "$PACKAGE_TMP" > "$BINARY_TMP"
else
  gunzip -c "$PACKAGE_TMP" > "$BINARY_TMP"
fi

ACTUAL_SIZE="$(wc -c < "$BINARY_TMP" | tr -d ' ')"
if [ "$ACTUAL_SIZE" != "$EXPECTED_SIZE" ]; then
  fail "Size mismatch / 程序大小不匹配: expected $EXPECTED_SIZE, got $ACTUAL_SIZE."
fi

step "Verifying binary / 校验程序"
ACTUAL_SHA="$(sha256_file "$BINARY_TMP")"
if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
  fail "Checksum mismatch / 程序校验失败: expected $EXPECTED_SHA, got $ACTUAL_SHA."
fi
ok "Binary verified / 程序校验通过"

step "Installing / 安装"
mkdir -p "$INSTALL_DIR"
TARGET="$INSTALL_DIR/secai"
cp "$BINARY_TMP" "$TARGET"
chmod 755 "$TARGET"

add_path_hint "$INSTALL_DIR"
ok "Installed / 安装完成: $TARGET"
"$TARGET" --version
info ""
rule
ok "SecAI is ready / SecAI 已就绪。"
rule
info ""
