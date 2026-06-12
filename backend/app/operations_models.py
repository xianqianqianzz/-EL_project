from datetime import datetime

from pydantic import BaseModel


class ReadinessResponse(BaseModel):
    status: str
    database: str
    map_data: str


class OperationStatus(BaseModel):
    environment: str
    service_status: str
    database_status: str
    map_data_status: str
    backup_count: int
    latest_backup_at: datetime | None
    github_update_mode: str


class BackupRecord(BaseModel):
    name: str
    created_at: datetime
    size_bytes: int
