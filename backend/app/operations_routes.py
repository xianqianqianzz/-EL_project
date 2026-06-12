from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.area_repository import AreaRepository
from backend.app.auth import require_roles
from backend.app.backup_service import BackupService
from backend.app.config import PROJECT_ROOT, get_settings
from backend.app.database import get_db
from backend.app.operations_models import BackupRecord, OperationStatus, ReadinessResponse
from backend.app.user_model import User


router = APIRouter(prefix="/api/v1", tags=["operations"])


def check_database(db: Session) -> str:
    try:
        db.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        return "error"


def check_map_data() -> str:
    try:
        AreaRepository(PROJECT_ROOT).public_index()
        return "ok"
    except Exception:
        return "error"


def backup_record(path) -> BackupRecord:
    stat = path.stat()
    return BackupRecord(
        name=path.name,
        created_at=datetime.fromtimestamp(stat.st_mtime, timezone.utc),
        size_bytes=stat.st_size,
    )


@router.get("/health/ready", response_model=ReadinessResponse)
def readiness(db: Session = Depends(get_db)) -> ReadinessResponse:
    database = check_database(db)
    map_data = check_map_data()
    if database != "ok" or map_data != "ok":
        raise HTTPException(status_code=503, detail={"database": database, "map_data": map_data})
    return ReadinessResponse(status="ready", database=database, map_data=map_data)


@router.get("/admin/operations", response_model=OperationStatus)
def operation_status(
    _: User = Depends(require_roles("staff", "admin")),
    db: Session = Depends(get_db),
) -> OperationStatus:
    backups = BackupService().list_backups()
    return OperationStatus(
        environment=get_settings().environment,
        service_status="正常",
        database_status="正常" if check_database(db) == "ok" else "异常",
        map_data_status="正常" if check_map_data() == "ok" else "异常",
        backup_count=len(backups),
        latest_backup_at=(
            datetime.fromtimestamp(backups[0].stat().st_mtime, timezone.utc) if backups else None
        ),
        github_update_mode="服务器管理员受控脚本",
    )


@router.get("/admin/backups", response_model=list[BackupRecord])
def list_backups(
    _: User = Depends(require_roles("staff", "admin")),
) -> list[BackupRecord]:
    return [backup_record(path) for path in BackupService().list_backups()]


@router.post("/admin/backups", response_model=BackupRecord, status_code=201)
def create_backup(
    _: User = Depends(require_roles("admin")),
) -> BackupRecord:
    return backup_record(BackupService().create())
