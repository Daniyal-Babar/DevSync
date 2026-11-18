from typing import List, Set
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "DevSync"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://devsync:devsync@localhost:5432/devsync"

    # JWT Security
    JWT_SECRET_KEY: str = "devsync-jwt-secret-key-phase1-insecure-default"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Storage
    WORKSPACES_ROOT: str = "./data/workspaces"
    MAX_FILE_SIZE_BYTES: int = 2 * 1024 * 1024  # 2MB max text file size
    IGNORED_TREE_NAMES: Set[str] = {
        ".git",
        "node_modules",
        "__pycache__",
        ".pytest_cache",
        ".DS_Store",
        ".venv",
        "venv"
    }

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]


settings = Settings()
