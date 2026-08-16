import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Document
from app.rag import answer_question
from app.schemas import ChatRequest, ChatResponse, SourceChunk

router = APIRouter(prefix="/documents", tags=["chat"])


@router.post("/{document_id}/chat", response_model=ChatResponse)
def chat_with_document(document_id: uuid.UUID, request: ChatRequest, db: Session = Depends(get_db)):
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if document.status != "ready":
        raise HTTPException(status_code=409, detail=f"Document is not ready (status: {document.status})")

    answer, chunks = answer_question(db, document_id, request.question)
    sources = [SourceChunk(chunk_index=c.chunk_index, content=c.content) for c in chunks]
    return ChatResponse(answer=answer, sources=sources)
