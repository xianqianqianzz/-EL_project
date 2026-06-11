import os
from pathlib import Path
import subprocess
import sys
import tempfile


def test_alembic_upgrades_empty_database_to_head() -> None:
    with tempfile.TemporaryDirectory(prefix="nju-campus-map-") as directory:
        database_path = Path(directory) / "migration-test.db"
        environment = os.environ.copy()
        environment["NJU_DATABASE_URL"] = f"sqlite:///{database_path.as_posix()}"

        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=Path(__file__).resolve().parents[2],
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )

        assert result.returncode == 0, result.stderr
        assert database_path.is_file()
