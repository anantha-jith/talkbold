from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ANTHROPIC_API_KEY: str
    MONGODB_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "mock_viva"
    UPLOAD_DIR: str = "uploads"
    CHROMA_DIR: str = "chroma_db"

    class Config:
        env_file = ".env"

settings = Settings()