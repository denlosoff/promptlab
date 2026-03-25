param(
  [Parameter(Mandatory = $true)]
  [string]$TunnelToken
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverPort = 3010
$serverLog = Join-Path $projectRoot 'server.cloudflare.log'
$serverErrorLog = Join-Path $projectRoot 'server.cloudflare.err.log'
$cloudflaredPath = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$dataRoot = 'C:\Users\ADMIN\Toggle'

Set-Location $projectRoot

function Get-LatestPromptlabDataFile {
  if (-not (Test-Path $dataRoot)) {
    return $null
  }

  return Get-ChildItem $dataRoot -Filter 'promptlab-data*.json' -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
}

function Test-WebDbNeedsBuild {
  $manifestPath = Join-Path $dataRoot 'webdb\manifest.json'
  $sourceDataFile = Get-LatestPromptlabDataFile

  if (-not $sourceDataFile -or -not (Test-Path $manifestPath)) {
    return $true
  }

  return $sourceDataFile.LastWriteTimeUtc -gt (Get-Item $manifestPath).LastWriteTimeUtc
}

function Test-FrontendNeedsBuild {
  $distIndexPath = Join-Path $projectRoot 'dist\index.html'
  if (-not (Test-Path $distIndexPath)) {
    return $true
  }

  $referenceFiles = @(
    (Get-ChildItem (Join-Path $projectRoot 'src') -Recurse -File),
    (Get-Item (Join-Path $projectRoot 'index.html')),
    (Get-Item (Join-Path $projectRoot 'package.json')),
    (Get-Item (Join-Path $projectRoot 'vite.config.ts'))
  ) | Where-Object { $_ }

  $latestSourceWrite = ($referenceFiles | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1).LastWriteTimeUtc
  $distWrite = (Get-Item $distIndexPath).LastWriteTimeUtc

  return $latestSourceWrite -gt $distWrite
}

if (-not (Test-Path $cloudflaredPath)) {
  Write-Host 'cloudflared was not found at C:\Program Files (x86)\cloudflared\cloudflared.exe'
  exit 1
}

if (Test-WebDbNeedsBuild) {
  Write-Host 'Preparing Web DB...'
  npm run build:webdb | Out-Host
} else {
  Write-Host 'Web DB is up to date. Skipping rebuild.'
}

if (Test-FrontendNeedsBuild) {
  Write-Host 'Building frontend...'
  npm run build | Out-Host
} else {
  Write-Host 'Frontend build is up to date. Skipping rebuild.'
}

Write-Host "Starting local server on http://localhost:$serverPort ..."
Start-Process -FilePath 'cmd.exe' `
  -ArgumentList '/c', "set PORT=$serverPort && set NODE_OPTIONS=--max-old-space-size=8192 && npm start" `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $serverLog `
  -RedirectStandardError $serverErrorLog

$healthUrl = "http://localhost:$serverPort/api/health"
$ready = $false

for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 1

  try {
    $response = Invoke-WebRequest -UseBasicParsing $healthUrl
    if ($response.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
  }
}

if (-not $ready) {
  Write-Host 'Server did not become ready. Recent log output:'
  if (Test-Path $serverLog) {
    Get-Content -Tail 40 $serverLog
  }
  if (Test-Path $serverErrorLog) {
    Get-Content -Tail 40 $serverErrorLog
  }
  exit 1
}

Write-Host "Local server is ready on http://localhost:$serverPort"
Write-Host 'Starting Cloudflare named tunnel...'
Write-Host 'Keep this window open while the site should stay public.'

& $cloudflaredPath tunnel run --token $TunnelToken
