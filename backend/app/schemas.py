import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: uuid.UUID
    filename: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class SourceChunk(BaseModel):
    chunk_index: int
    content: str


class ChatRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
