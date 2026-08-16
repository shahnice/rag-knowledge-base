import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.embeddings import embed_texts
from app.models import Business, Chunk, Document
from app.pdf import chunk_text, extract_text
from app.schemas import DocumentOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/businesses/{business_id}/documents", tags=["documents"])


def _get_business_or_404(db: Session, business_id: uuid.UUID) -> Business:
    business = db.get(Business, business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business


@router.get("", response_model=list[DocumentOut])
def list_documents(business_id: uuid.UUID, db: Session = Depends(get_db)):
    _get_business_or_404(db, business_id)
    return (
        db.query(Document)
        .filter(Document.business_id == business_id)
        .order_by(Document.created_at.desc())
        .all()
    )


@router.post("", response_model=DocumentOut)
async def upload_document(business_id: uuid.UUID, file: UploadFile, db: Session = Depends(get_db)):
    _get_business_or_404(db, business_id)
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    pdf_bytes = await file.read()

    document = Document(business_id=business_id, filename=file.filename, status="processing")
    db.add(document)
    db.commit()
    db.refresh(document)

    try:
        text = extract_text(pdf_bytes)
        pieces = chunk_text(text)
        if not pieces:
            raise ValueError("No extractable text found in PDF")

        vectors = embed_texts(pieces)
        for index, (content, vector) in enumerate(zip(pieces, vectors)):
            db.add(Chunk(document_id=document.id, chunk_index=index, content=content, embedding=vector))

        document.status = "ready"
        db.commit()
        db.refresh(document)
    except Exception:
        logger.exception("Failed to process PDF for document %s", document.id)
        document.status = "failed"
        db.commit()
        raise HTTPException(status_code=422, detail="Failed to process PDF")

    return document


@router.delete("/{document_id}", status_code=204)
def delete_document(business_id: uuid.UUID, document_id: uuid.UUID, db: Session = Depends(get_db)):
    document = db.get(Document, document_id)
    if not document or document.business_id != business_id:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(document)
    db.commit()
