# backend/app/core/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DB_HOST: str
    DB_PORT: str
    DB_USER: str
    DB_PASSWORD: str
    DEEPL_API_KEY: str
    LOG_DIR: str
    ZYTE_API_KEY: str = ""
    ENV: str = "prod"

    class Config:
        env_file = ".env"


settings = Settings()