import uuid
from datetime import datetime

from pydantic import BaseModel


class BusinessCreate(BaseModel):
    name: str
    greeting: str | None = None
    persona_instructions: str | None = None
    voice: str | None = None
    phone_number: str | None = None


class BusinessUpdate(BaseModel):
    name: str | None = None
    greeting: str | None = None
    persona_instructions: str | None = None
    voice: str | None = None
    phone_number: str | None = None


class BusinessOut(BaseModel):
    id: uuid.UUID
    name: str
    greeting: str
    persona_instructions: str
    voice: str
    phone_number: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    filename: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class SourceChunk(BaseModel):
    chunk_index: int
    content: str


class SourceQAPair(BaseModel):
    question: str
    answer: str


class ChatRequest(BaseModel):
    question: str
    openai_api_key: str


class ChatResponse(BaseModel):
    answer: str
    qa_sources: list[SourceQAPair]
    chunk_sources: list[SourceChunk]


class QAPairCreate(BaseModel):
    question: str
    answer: str
    openai_api_key: str


class QAPairUpdate(BaseModel):
    question: str | None = None
    answer: str | None = None
    openai_api_key: str


class QAPairOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    question: str
    answer: str
    created_at: datetime

    class Config:
        from_attributes = True


class ValidateKeyRequest(BaseModel):
    openai_api_key: str


class ValidateKeyResponse(BaseModel):
    valid: bool
    detail: str | None = None


class CallTurnOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class CallOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    channel: str
    status: str
    started_at: datetime
    ended_at: datetime | None

    class Config:
        from_attributes = True


class CallDetailOut(CallOut):
    turns: list[CallTurnOut]

    class Config:
        from_attributes = True
