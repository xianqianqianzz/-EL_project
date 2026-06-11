@echo off
cd /d "%~dp0.."
python -m alembic upgrade head
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
