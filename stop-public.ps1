$ErrorActionPreference = 'SilentlyContinue'

Get-Process cloudflared | Stop-Process -Force

$connections = Get-NetTCPConnection -LocalPort 3010 -State Listen
foreach ($connection in $connections) {
  Stop-Process -Id $connection.OwningProcess -Force
}

Write-Host 'Public tunnel and local public server were stopped.'
