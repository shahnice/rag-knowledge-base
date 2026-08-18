import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Business
from app.rag import answer_question
from app.schemas import ChatRequest, ChatResponse, SourceChunk, SourceQAPair

router = APIRouter(prefix="/businesses/{business_id}", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat_with_business(business_id: uuid.UUID, request: ChatRequest, db: Session = Depends(get_db)):
    business = db.get(Business, business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    answer, qa_pairs, chunks = answer_question(db, business_id, request.question, request.openai_api_key)
    qa_sources = [SourceQAPair(question=qa.question, answer=qa.answer) for qa in qa_pairs]
    chunk_sources = [SourceChunk(chunk_index=c.chunk_index, content=c.content) for c in chunks]
    return ChatResponse(answer=answer, qa_sources=qa_sources, chunk_sources=chunk_sources)
