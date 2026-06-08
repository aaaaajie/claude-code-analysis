param(
  [string]$BaseUrl = $(if ($env:SECAI_UPDATE_BASE_URL) { $env:SECAI_UPDATE_BASE_URL } else { "https://ai.rzsec.cn/downloads/secai-cli" }),
  [string]$Channel = $(if ($env:SECAI_UPDATE_CHANNEL) { $env:SECAI_UPDATE_CHANNEL } else { "latest" }),
  [string]$Version = "",
  [string]$InstallDir = $(if ($env:SECAI_INSTALL_DIR) { $env:SECAI_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "SecAI\bin" })
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Section([string]$Text) {
  Write-Host ""
  Write-Host "----------------------------------------" -ForegroundColor DarkGray
  Write-Host "SecAI CLI Installer" -ForegroundColor Cyan
  Write-Host "$Text / 安全下载并校验安装包" -ForegroundColor DarkGray
  Write-Host "----------------------------------------" -ForegroundColor DarkGray
  Write-Host ""
}

function Write-Step([string]$Text) {
  Write-Host "==> $Text" -ForegroundColor Cyan
}

function Write-Ok([string]$Text) {
  Write-Host "OK  $Text" -ForegroundColor Green
}

function Write-Warn([string]$Text) {
  Write-Host "WARN $Text" -ForegroundColor Yellow
}

function Write-SummaryRow([string]$Name, [string]$Value) {
  Write-Host ("  {0,-9} {1}" -f $Name, $Value)
}

function Format-Bytes([int64]$Bytes) {
  $units = @("B", "KiB", "MiB", "GiB")
  $value = [double]$Bytes
  $index = 0
  while ($value -ge 1024 -and $index -lt ($units.Length - 1)) {
    $value = $value / 1024
    $index++
  }
  if ($index -eq 0) {
    return ("{0:N0} {1}" -f $value, $units[$index])
  }
  return ("{0:N2} {1}" -f $value, $units[$index])
}

function Normalize-BaseUrl([string]$Url) {
  return $Url.TrimEnd("/")
}

function Get-SecAIPlatform {
  if ($PSVersionTable.PSEdition -eq "Core" -and -not $IsWindows) {
    throw "This installer is for Windows. macOS/Linux 请使用 install.sh。"
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

  throw "Unsupported platform: windows-$($arch.ToLowerInvariant()). 不支持的平台。Supported platforms: windows-x64, windows-arm64, macos-arm64, macos-x64, linux-x64, linux-arm64"
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
    Write-Ok "PATH updated / 已写入用户 PATH。"
    Write-Warn "Reopen PowerShell, or run / 重新打开 PowerShell，或执行: `$env:Path = `"$Dir;`$env:Path`""
  } else {
    Write-Ok "PATH already configured / PATH 已配置。"
  }
}

function Save-Url([string]$Uri, [string]$OutFile, [switch]$ShowProgress) {
  $maxAttempts = 3
  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    try {
      Remove-Item -Force $OutFile -ErrorAction SilentlyContinue
      if ($ShowProgress) {
        Save-UrlWithProgress $Uri $OutFile
      } else {
        Invoke-WebRequest -Uri $Uri -OutFile $OutFile -UseBasicParsing
      }
      return
    } catch {
      Complete-TextProgress
      if ($attempt -eq $maxAttempts) {
        throw "Failed to download $Uri after $maxAttempts attempts / 下载失败: $($_.Exception.Message)"
      }
      Write-Host "Download failed, retrying ($attempt/$maxAttempts) / 下载失败，正在重试..."
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
}

function Write-TextProgress([int64]$Received, [int64]$Total) {
  $width = 28
  if ($Total -gt 0) {
    $percentValue = [Math]::Min(100, [double]$Received * 100 / [double]$Total)
    $filled = [Math]::Min($width, [int][Math]::Floor($percentValue * $width / 100))
    $empty = $width - $filled
    $bar = ("#" * $filled) + ("-" * $empty)
    $line = ("  [{0}] {1,6:N1}%  {2} / {3}" -f $bar, $percentValue, (Format-Bytes $Received), (Format-Bytes $Total))
  } else {
    $line = ("  Downloaded {0}" -f (Format-Bytes $Received))
  }

  Write-Host -NoNewline "`r$line"
}

function Complete-TextProgress {
  Write-Host ""
}

function Save-UrlWithProgress([string]$Uri, [string]$OutFile) {
  $request = [Net.HttpWebRequest]::Create($Uri)
  $request.UserAgent = "SecAI-Installer"
  $response = $request.GetResponse()
  try {
    $total = [int64]$response.ContentLength
    $inputStream = $response.GetResponseStream()
    $outputStream = [IO.File]::Create($OutFile)
    try {
      $buffer = New-Object byte[] 1048576
      $received = [int64]0
      $lastRender = [DateTime]::UtcNow.AddSeconds(-2)
      while (($read = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $outputStream.Write($buffer, 0, $read)
        $received += $read
        $now = [DateTime]::UtcNow
        if (($now - $lastRender).TotalMilliseconds -ge 200 -or ($total -gt 0 -and $received -eq $total)) {
          Write-TextProgress $received $total
          $lastRender = $now
        }
      }
      Write-TextProgress $received $total
      Complete-TextProgress
    } finally {
      $outputStream.Dispose()
      $inputStream.Dispose()
    }
  } finally {
    $response.Dispose()
  }
}

function Expand-GzipFile([string]$Source, [string]$Destination) {
  $inputStream = [IO.File]::OpenRead($Source)
  try {
    $outputStream = [IO.File]::Create($Destination)
    try {
      $gzipStream = [IO.Compression.GzipStream]::new($inputStream, [IO.Compression.CompressionMode]::Decompress)
      try {
        $gzipStream.CopyTo($outputStream)
      } finally {
        $gzipStream.Dispose()
      }
    } finally {
      $outputStream.Dispose()
    }
  } finally {
    $inputStream.Dispose()
  }
}

$BaseUrl = Normalize-BaseUrl $BaseUrl
$Platform = Get-SecAIPlatform
Write-Section "Secure install with verified downloads"

if (-not $Version) {
  Write-Step "Resolving latest version / 获取最新版本 ($Channel)"
  $Version = (Invoke-RestMethod -Uri "$BaseUrl/$Channel").ToString().Trim()
}

if (-not $Version) {
  throw "Unable to resolve SecAI version from $BaseUrl/$Channel / 无法获取 SecAI 版本"
}

$tmpDir = Join-Path ([IO.Path]::GetTempPath()) ("secai-install-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

try {
  $manifestPath = Join-Path $tmpDir "manifest.json"
  $binaryPath = Join-Path $tmpDir "secai.exe.download"
  $packagePath = Join-Path $tmpDir "secai.exe.package"

  Write-Step "Downloading manifest / 下载版本清单"
  Save-Url "$BaseUrl/$Version/manifest.json" $manifestPath
  $manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
  $platformInfo = $manifest.platforms.$Platform
  if (-not $platformInfo) {
    throw "Unsupported platform: $Platform / 不支持的平台。Supported platforms: windows-x64, windows-arm64, macos-arm64, macos-x64, linux-x64, linux-arm64"
  }
  if (-not $platformInfo.binary -or -not $platformInfo.checksum -or -not $platformInfo.size -or -not $platformInfo.download -or $platformInfo.compression -ne "gzip" -or -not $platformInfo.downloadChecksum -or -not $platformInfo.downloadSize) {
    throw "Invalid manifest for $Version $Platform. Gzip download metadata is required / 清单缺少 gzip 下载信息。"
  }

  Write-Host "----------------------------------------" -ForegroundColor DarkGray
  Write-SummaryRow "版本" $Version
  Write-SummaryRow "平台" $Platform
  Write-SummaryRow "下载大小" (Format-Bytes ([int64]$platformInfo.downloadSize))
  Write-SummaryRow "安装目录" $InstallDir
  Write-Host "----------------------------------------" -ForegroundColor DarkGray
  Write-Host ""

  Write-Step "Downloading SecAI / 下载 SecAI"
  Save-Url "$BaseUrl/$Version/$Platform/$($platformInfo.download)" $packagePath -ShowProgress

  $actualDownloadSize = (Get-Item $packagePath).Length
  if ($actualDownloadSize -ne [int64]$platformInfo.downloadSize) {
    throw "Compressed size mismatch / 压缩包大小不匹配: expected $($platformInfo.downloadSize), got $actualDownloadSize"
  }

  Write-Step "Verifying compressed package / 校验压缩包"
  $actualDownloadHash = (Get-FileHash -Algorithm SHA256 -Path $packagePath).Hash.ToLowerInvariant()
  if ($actualDownloadHash -ne $platformInfo.downloadChecksum.ToLowerInvariant()) {
    throw "Compressed checksum mismatch / 压缩包校验失败: expected $($platformInfo.downloadChecksum), got $actualDownloadHash"
  }
  Write-Ok "Compressed package verified / 压缩包校验通过。"

  Write-Step "Unpacking binary / 解压程序"
  Expand-GzipFile $packagePath $binaryPath

  $actualSize = (Get-Item $binaryPath).Length
  if ($actualSize -ne [int64]$platformInfo.size) {
    throw "Size mismatch / 程序大小不匹配: expected $($platformInfo.size), got $actualSize"
  }

  Write-Step "Verifying binary / 校验程序"
  $actualHash = (Get-FileHash -Algorithm SHA256 -Path $binaryPath).Hash.ToLowerInvariant()
  if ($actualHash -ne $platformInfo.checksum.ToLowerInvariant()) {
    throw "Checksum mismatch / 程序校验失败: expected $($platformInfo.checksum), got $actualHash"
  }
  Write-Ok "Binary verified / 程序校验通过。"

  Write-Step "Installing / 安装"
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  $target = Join-Path $InstallDir "secai.exe"
  Copy-Item -Force -Path $binaryPath -Destination $target

  Add-UserPath $InstallDir
  Write-Ok "Installed / 安装完成: $target"
  & $target --version
  Write-Warn "Git for Windows is required when SecAI executes shell tools / 使用 shell 工具需要安装 Git for Windows。"
  Write-Host "Install Git / 安装 Git:"
  Write-Host "  winget install --id Git.Git -e --source winget"
  Write-Host "  choco install git -y"
  Write-Host "  https://git-scm.com/download/win"
  Write-Host ""
  Write-Host "----------------------------------------" -ForegroundColor DarkGray
  Write-Ok "SecAI is ready / SecAI 已就绪。"
  Write-Host "----------------------------------------" -ForegroundColor DarkGray
} finally {
  Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}
