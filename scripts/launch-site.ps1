param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
$runtimeRoot = Join-Path $env:LOCALAPPDATA "nju-campus-map"
$logPath = Join-Path $runtimeRoot "launcher.log"
$backendOut = Join-Path $runtimeRoot "backend.out.log"
$backendError = Join-Path $runtimeRoot "backend.error.log"

New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
Set-Content -LiteralPath $logPath -Encoding UTF8 -Value "[$(Get-Date -Format s)] Starting NJU Campus Map from $projectRoot"

function Write-LauncherLog([string]$Message) {
  Add-Content -LiteralPath $logPath -Encoding UTF8 -Value "[$(Get-Date -Format s)] $Message"
}

function Show-LauncherError([string]$Message) {
  Write-LauncherLog $Message
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    "$Message`n`nDetailed log: $logPath",
    "NJU Campus Map - Startup Failed"
  ) | Out-Null
  exit 1
}

function Test-Url([string]$Url) {
  try {
    return (Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 3).StatusCode -eq 200
  } catch {
    return $false
  }
}

function Find-Python {
  foreach ($candidate in @("python", "python3")) {
    $command = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($command -and $command.CommandType -eq "Application") {
      try {
        $version = & $command.Source -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
        if ($LASTEXITCODE -eq 0) {
          return @{ File = $command.Source; Prefix = @(); Version = $version }
        }
      } catch {}
    }
  }

  $py = Get-Command "py" -ErrorAction SilentlyContinue
  if ($py -and $py.CommandType -eq "Application") {
    try {
      $version = & $py.Source -3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
      if ($LASTEXITCODE -eq 0) {
        return @{ File = $py.Source; Prefix = @("-3"); Version = $version }
      }
    } catch {}
  }
  return $null
}

function Invoke-Python([hashtable]$Python, [string[]]$Arguments) {
  $allArguments = @($Python.Prefix) + $Arguments
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & $Python.File @allArguments 2>&1 | Out-File -LiteralPath $logPath -Append -Encoding UTF8
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
}

$python = Find-Python
if (-not $python) {
  Show-LauncherError "Python 3 was not found. Install Python 3.10 or newer from python.org and enable Add Python to PATH."
}
Write-LauncherLog "Using Python $($python.Version): $($python.File)"

$requiredModules = "import fastapi, uvicorn, sqlalchemy, alembic, jwt, pwdlib, pydantic_settings"
$dependencyArguments = @("-c", $requiredModules)
$dependencyCheck = Invoke-Python -Python $python -Arguments $dependencyArguments
if ($dependencyCheck -ne 0) {
  Write-LauncherLog "Backend dependencies are missing; installing requirements."
  $installArguments = @("-m", "pip", "install", "-r", (Join-Path $projectRoot "backend\requirements.txt"))
  $installResult = Invoke-Python -Python $python -Arguments $installArguments
  if ($installResult -ne 0) {
    Show-LauncherError "Required Python packages could not be installed. Check the network connection and the pip error in the log."
  }
}

Write-LauncherLog "Running database migrations."
$migrationArguments = @("-m", "alembic", "-c", (Join-Path $projectRoot "alembic.ini"), "upgrade", "head")
$migrationResult = Invoke-Python -Python $python -Arguments $migrationArguments
if ($migrationResult -ne 0) {
  Show-LauncherError "Database initialization failed. Check the Alembic error in the log."
}

Write-LauncherLog "Creating development evaluation accounts."
$seedArguments = @((Join-Path $projectRoot "scripts\seed_evaluation_accounts.py"))
$seedResult = Invoke-Python -Python $python -Arguments $seedArguments
if ($seedResult -ne 0) {
  Show-LauncherError "Evaluation accounts could not be created. Check the detailed log."
}

if (Test-Url "http://localhost:8000/api/v1/health") {
  Write-LauncherLog "Existing backend is healthy and evaluation accounts are ready; opening site."
  if (-not $NoBrowser) { Start-Process "http://localhost:8000/" }
  exit 0
}

Remove-Item -LiteralPath $backendOut, $backendError -Force -ErrorAction SilentlyContinue
$backendArguments = @($python.Prefix) + @("-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "8000")
Write-LauncherLog "Starting backend on port 8000."
try {
  $backend = Start-Process -FilePath $python.File `
    -ArgumentList $backendArguments `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $backendOut `
    -RedirectStandardError $backendError `
    -PassThru
} catch {
  Show-LauncherError "Could not start the backend process: $($_.Exception.Message)"
}

for ($attempt = 0; $attempt -lt 60; $attempt++) {
  if (Test-Url "http://localhost:8000/api/v1/health") {
    Write-LauncherLog "Backend is healthy; opening site."
    if (-not $NoBrowser) { Start-Process "http://localhost:8000/" }
    exit 0
  }
  if ($backend.HasExited) {
    $details = if (Test-Path $backendError) { (Get-Content -LiteralPath $backendError -Tail 12) -join "`n" } else { "The backend process did not provide error output." }
    Show-LauncherError "The backend exited during startup.`n`n$details"
  }
  Start-Sleep -Seconds 1
}

$portOwner = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($portOwner) {
  Show-LauncherError "Port 8000 is used by another program (process ID $($portOwner.OwningProcess)). Close that program and try again."
}
Show-LauncherError "The backend was not ready within 60 seconds. Check the detailed log."
