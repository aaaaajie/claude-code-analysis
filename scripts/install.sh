#!/usr/bin/env sh
set -eu

BASE_URL="${SECAI_UPDATE_BASE_URL:-https://ai.rzsec.cn/downloads/secai-cli}"
CHANNEL="${SECAI_UPDATE_CHANNEL:-latest}"
VERSION=""
INSTALL_DIR="${SECAI_INSTALL_DIR:-$HOME/.secai/bin}"

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
    printf 'curl or wget is required.\n' >&2
    exit 1
  fi
}

download_file() {
  url="$1"
  output="$2"
  if have curl; then
    curl -fL "$url" -o "$output"
  elif have wget; then
    wget -O "$output" "$url"
  else
    printf 'curl or wget is required.\n' >&2
    exit 1
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
      printf 'Please use PowerShell installer on Windows: irm https://ai.rzsec.cn/install.ps1 | iex\n' >&2
      exit 1
      ;;
    *)
      unsupported "$os-$arch"
      ;;
  esac
}

unsupported() {
  printf 'Unsupported platform: %s\n' "$1" >&2
  printf 'Supported platforms: windows-x64, windows-arm64, macos-arm64, macos-x64, linux-x64, linux-arm64\n' >&2
  exit 1
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
    printf 'sha256sum or shasum is required.\n' >&2
    exit 1
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
  fi

  printf 'Updated PATH in %s. Reopen your terminal, or run:\n' "$rc_file"
  printf '  export PATH="%s:$PATH"\n' "$bin_dir"
}

PLATFORM="$(detect_platform)"
if [ -z "$VERSION" ]; then
  VERSION="$(fetch_text "$BASE_URL/$CHANNEL" | tr -d '\r\n ')"
fi

if [ -z "$VERSION" ]; then
  printf 'Unable to resolve SecAI version from %s/%s\n' "$BASE_URL" "$CHANNEL" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t secai)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

MANIFEST="$TMP_DIR/manifest.json"
BINARY_TMP="$TMP_DIR/secai.download"
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

if [ -z "$BINARY_NAME" ] || [ -z "$EXPECTED_SHA" ] || [ -z "$EXPECTED_SIZE" ]; then
  printf 'Invalid manifest for %s %s.\n' "$VERSION" "$PLATFORM" >&2
  exit 1
fi

printf 'Installing SecAI %s for %s...\n' "$VERSION" "$PLATFORM"
download_file "$BASE_URL/$VERSION/$PLATFORM/$BINARY_NAME" "$BINARY_TMP"

ACTUAL_SIZE="$(wc -c < "$BINARY_TMP" | tr -d ' ')"
if [ "$ACTUAL_SIZE" != "$EXPECTED_SIZE" ]; then
  printf 'Size mismatch: expected %s, got %s.\n' "$EXPECTED_SIZE" "$ACTUAL_SIZE" >&2
  exit 1
fi

ACTUAL_SHA="$(sha256_file "$BINARY_TMP")"
if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
  printf 'Checksum mismatch: expected %s, got %s.\n' "$EXPECTED_SHA" "$ACTUAL_SHA" >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
TARGET="$INSTALL_DIR/secai"
cp "$BINARY_TMP" "$TARGET"
chmod 755 "$TARGET"

add_path_hint "$INSTALL_DIR"
printf 'Installed SecAI: %s\n' "$TARGET"
"$TARGET" --version
