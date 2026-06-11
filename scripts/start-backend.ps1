$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
python -m alembic upgrade head
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
