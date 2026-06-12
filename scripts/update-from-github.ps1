$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

if ((git branch --show-current).Trim() -ne "master") {
  throw "Update is only allowed from the master branch."
}
if (git status --porcelain) {
  throw "Working tree is not clean. Commit or discard local changes before updating."
}

python scripts/create-backup.py
git fetch origin master
git merge --ff-only origin/master
python -m alembic upgrade head
npm.cmd run check

Write-Host "Update completed. Restart the service to load the new version." -ForegroundColor Green
