$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tokenFile = Join-Path $projectRoot 'cloudflare-tunnel-token.txt'
$startScript = Join-Path $projectRoot 'start-cloudflare-domain.ps1'

if (-not (Test-Path $tokenFile)) {
  Write-Host 'Token file not found:'
  Write-Host $tokenFile
  exit 1
}

$tunnelToken = (Get-Content $tokenFile -Raw).Trim()
if (-not $tunnelToken) {
  Write-Host 'Tunnel token file is empty.'
  exit 1
}

Get-NetTCPConnection -LocalPort 3010 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }

Get-Process cloudflared -ErrorAction SilentlyContinue |
  Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 1

& powershell -ExecutionPolicy Bypass -File $startScript -TunnelToken $tunnelToken
