# backend/app/core/config.py
from pydantic_settings import BaseSettings
import urllib.parse


class Settings(BaseSettings):
    DB_HOST: str
    DB_PORT: str
    DB_USER: str
    DB_PASSWORD: str
    CRAWLER_DB: str
    ENVIRONMENT: str

    @property
    def database_url(self):
        user = urllib.parse.quote_plus(self.DB_USER)
        password = urllib.parse.quote_plus(self.DB_PASSWORD)

        # Base connection string
        base_url = "mongodb://%s:%s@%s:%s" % (user, password, self.DB_HOST, self.DB_PORT)
        return base_url

    class Config:
        env_file = ".env"


settings = Settings()