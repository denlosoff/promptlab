$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverPort = 3010
$serverLog = Join-Path $projectRoot 'server.public.log'
$serverErrorLog = Join-Path $projectRoot 'server.public.err.log'
$cloudflaredPath = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'

Set-Location $projectRoot

Write-Host 'Building frontend...'
npm run build | Out-Host

Write-Host "Starting local server on http://localhost:$serverPort ..."
Start-Process -FilePath 'cmd.exe' `
  -ArgumentList '/c', "set PORT=$serverPort && npm start" `
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
Write-Host 'Starting Cloudflare tunnel...'
Write-Host 'Keep this window open while the site should stay public.'

if (-not (Test-Path $cloudflaredPath)) {
  Write-Host 'cloudflared was not found at the expected path.'
  exit 1
}

& $cloudflaredPath tunnel --url "http://localhost:$serverPort"
