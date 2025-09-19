from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # === App Config ===
    APP_NAME: str = "FaceAttendance"
    APP_ENV: str = "development"
    APP_PORT: int = 8000

    # === Database ===
    MONGO_URI: str

    # === Security ===
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # === Paths ===
    UPLOAD_DIR: str = "data/images"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
