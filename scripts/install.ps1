param(
  [string]$BaseUrl = $(if ($env:SECAI_UPDATE_BASE_URL) { $env:SECAI_UPDATE_BASE_URL } else { "https://ai.rzsec.cn/downloads/secai-cli" }),
  [string]$Channel = $(if ($env:SECAI_UPDATE_CHANNEL) { $env:SECAI_UPDATE_CHANNEL } else { "latest" }),
  [string]$Version = "",
  [string]$InstallDir = $(if ($env:SECAI_INSTALL_DIR) { $env:SECAI_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "SecAI\bin" })
)

$ErrorActionPreference = "Stop"

function Normalize-BaseUrl([string]$Url) {
  return $Url.TrimEnd("/")
}

function Get-SecAIPlatform {
  if ($PSVersionTable.PSEdition -eq "Core" -and -not $IsWindows) {
    throw "This installer is for Windows. Use install.sh on macOS or Linux."
  }

  $arch = $env:PROCESSOR_ARCHITECTURE
  if ($env:PROCESSOR_ARCHITEW6432) {
    $arch = $env:PROCESSOR_ARCHITEW6432
  }
  $arch = "$arch".ToUpperInvariant()

  if ($arch -eq "AMD64" -or $arch -eq "X64") {
    return "windows-x64"
  }
  if ($arch -eq "ARM64" -or $arch -eq "AARCH64") {
    return "windows-arm64"
  }

  throw "Unsupported platform: windows-$($arch.ToLowerInvariant()). Supported platforms: windows-x64, windows-arm64, macos-arm64, macos-x64, linux-x64, linux-arm64"
}

function Add-UserPath([string]$Dir) {
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $parts = @()
  if ($userPath) {
    $parts = $userPath -split ";" | Where-Object { $_ }
  }

  if ($parts -notcontains $Dir) {
    [Environment]::SetEnvironmentVariable("Path", (($parts + $Dir) -join ";"), "User")
    $env:Path = "$Dir;$env:Path"
    Write-Host "Updated user PATH. Reopen PowerShell, or run:"
    Write-Host "  `$env:Path = `"$Dir;`$env:Path`""
  }
}

function Save-Url([string]$Uri, [string]$OutFile) {
  $maxAttempts = 3
  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    try {
      Remove-Item -Force $OutFile -ErrorAction SilentlyContinue
      Invoke-WebRequest -Uri $Uri -OutFile $OutFile -UseBasicParsing
      return
    } catch {
      if ($attempt -eq $maxAttempts) {
        throw "Failed to download $Uri after $maxAttempts attempts: $($_.Exception.Message)"
      }
      Write-Host "Download failed, retrying ($attempt/$maxAttempts)..."
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
}

$BaseUrl = Normalize-BaseUrl $BaseUrl
$Platform = Get-SecAIPlatform

if (-not $Version) {
  $Version = (Invoke-RestMethod -Uri "$BaseUrl/$Channel").ToString().Trim()
}

if (-not $Version) {
  throw "Unable to resolve SecAI version from $BaseUrl/$Channel"
}

$tmpDir = Join-Path ([IO.Path]::GetTempPath()) ("secai-install-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

try {
  $manifestPath = Join-Path $tmpDir "manifest.json"
  $binaryPath = Join-Path $tmpDir "secai.exe.download"

  Save-Url "$BaseUrl/$Version/manifest.json" $manifestPath
  $manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
  $platformInfo = $manifest.platforms.$Platform
  if (-not $platformInfo) {
    throw "Unsupported platform: $Platform. Supported platforms: windows-x64, windows-arm64, macos-arm64, macos-x64, linux-x64, linux-arm64"
  }

  Write-Host "Installing SecAI $Version for $Platform..."
  Save-Url "$BaseUrl/$Version/$Platform/$($platformInfo.binary)" $binaryPath

  $actualSize = (Get-Item $binaryPath).Length
  if ($actualSize -ne [int64]$platformInfo.size) {
    throw "Size mismatch: expected $($platformInfo.size), got $actualSize"
  }

  $actualHash = (Get-FileHash -Algorithm SHA256 -Path $binaryPath).Hash.ToLowerInvariant()
  if ($actualHash -ne $platformInfo.checksum.ToLowerInvariant()) {
    throw "Checksum mismatch: expected $($platformInfo.checksum), got $actualHash"
  }

  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  $target = Join-Path $InstallDir "secai.exe"
  Copy-Item -Force -Path $binaryPath -Destination $target

  Add-UserPath $InstallDir
  Write-Host "Installed SecAI: $target"
  & $target --version
  Write-Host "Note: Git for Windows is required when SecAI executes shell tools."
} finally {
  Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}
