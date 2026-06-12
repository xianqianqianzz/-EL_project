from datetime import datetime, timezone
from pathlib import Path
import sqlite3
import zipfile

from backend.app.config import PROJECT_ROOT, get_settings


class BackupService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.backup_root = Path(self.settings.backup_root)

    def list_backups(self) -> list[Path]:
        if not self.backup_root.exists():
            return []
        return sorted(self.backup_root.glob("nju-campus-map-*.zip"), reverse=True)

    def create(self) -> Path:
        self.backup_root.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        target = self.backup_root / f"nju-campus-map-{timestamp}.zip"
        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            data_root = PROJECT_ROOT / "data" / "areas"
            for source in data_root.rglob("*"):
                if source.is_file():
                    archive.write(source, Path("data") / "areas" / source.relative_to(data_root))
            database_path = self._sqlite_database_path()
            if database_path and database_path.is_file():
                snapshot = self.backup_root / f".{timestamp}-app.db"
                with sqlite3.connect(database_path) as source, sqlite3.connect(snapshot) as destination:
                    source.backup(destination)
                archive.write(snapshot, Path("database") / "app.db")
                snapshot.unlink()
        return target

    def _sqlite_database_path(self) -> Path | None:
        prefixes = ("sqlite:///", "sqlite+pysqlite:///")
        prefix = next((item for item in prefixes if self.settings.database_url.startswith(item)), None)
        if not prefix:
            return None
        value = self.settings.database_url.removeprefix(prefix)
        if value == ":memory:" or value.endswith(":memory:"):
            return None
        return Path(value)
