from functools import lru_cache
import os
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_ROOT = Path(os.getenv("LOCALAPPDATA", Path.home())) / "nju-campus-map"
DEFAULT_DATABASE_PATH = DEFAULT_DATA_ROOT / "app.db"


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}"
    jwt_secret: str = Field(
        default="local-development-secret-change-before-deployment",
        min_length=32,
    )
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = Field(default=60, gt=0, le=1440)

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_prefix="NJU_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
