from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openai_api_key: str
    database_url: str = "postgresql+psycopg://rag:rag@localhost:5432/rag"

    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536
    chat_model: str = "gpt-4o-mini"

    chunk_size_chars: int = 2000
    chunk_overlap_chars: int = 200
    retrieval_top_k: int = 5

    openai_realtime_model: str = "gpt-realtime-2.1"
    browser_call_sample_rate: int = 24000

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
