$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent

function Test-Url([string]$Url) {
  try {
    return (Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 2).StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-Url "http://localhost:8000/api/v1/health")) {
  Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $PSScriptRoot "start-backend.ps1") `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden
}

if (-not (Test-Url "http://localhost:8080/index.html")) {
  Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $PSScriptRoot "start-frontend.ps1") `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden
}

for ($attempt = 0; $attempt -lt 15; $attempt++) {
  if ((Test-Url "http://localhost:8000/api/v1/health") -and (Test-Url "http://localhost:8080/index.html")) {
    Start-Process "http://localhost:8080/"
    exit 0
  }
  Start-Sleep -Milliseconds 600
}

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show("Startup timed out. Check Python and ports 8000/8080.", "NJU Campus Map") | Out-Null
exit 1
