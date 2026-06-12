FROM python:3.12-slim

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY . .

ENV NJU_DATABASE_URL=sqlite:////runtime/app.db
ENV NJU_BACKUP_ROOT=/runtime/backups
ENV NJU_ENVIRONMENT=production
EXPOSE 8000

CMD ["sh", "-c", "python -m alembic upgrade head && python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"]
