import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.embeddings import embed_text
from app.models import Business, QAPair
from app.schemas import QAPairCreate, QAPairOut, QAPairUpdate

router = APIRouter(prefix="/businesses/{business_id}/qa-pairs", tags=["qa-pairs"])


def _get_business_or_404(db: Session, business_id: uuid.UUID) -> Business:
    business = db.get(Business, business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business


def _embed_qa(question: str, answer: str, api_key: str) -> list[float]:
    return embed_text(f"Question: {question}\nAnswer: {answer}", api_key)


@router.get("", response_model=list[QAPairOut])
def list_qa_pairs(business_id: uuid.UUID, db: Session = Depends(get_db)):
    _get_business_or_404(db, business_id)
    return (
        db.query(QAPair)
        .filter(QAPair.business_id == business_id)
        .order_by(QAPair.created_at.desc())
        .all()
    )


@router.post("", response_model=QAPairOut)
def create_qa_pair(business_id: uuid.UUID, request: QAPairCreate, db: Session = Depends(get_db)):
    _get_business_or_404(db, business_id)
    qa_pair = QAPair(
        business_id=business_id,
        question=request.question,
        answer=request.answer,
        embedding=_embed_qa(request.question, request.answer, request.openai_api_key),
    )
    db.add(qa_pair)
    db.commit()
    db.refresh(qa_pair)
    return qa_pair


@router.patch("/{qa_id}", response_model=QAPairOut)
def update_qa_pair(
    business_id: uuid.UUID, qa_id: uuid.UUID, request: QAPairUpdate, db: Session = Depends(get_db)
):
    qa_pair = db.get(QAPair, qa_id)
    if not qa_pair or qa_pair.business_id != business_id:
        raise HTTPException(status_code=404, detail="Q&A pair not found")

    updates = request.model_dump(exclude={"openai_api_key"}, exclude_none=True)
    for field, value in updates.items():
        setattr(qa_pair, field, value)
    if "question" in updates or "answer" in updates:
        qa_pair.embedding = _embed_qa(qa_pair.question, qa_pair.answer, request.openai_api_key)

    db.commit()
    db.refresh(qa_pair)
    return qa_pair


@router.delete("/{qa_id}", status_code=204)
def delete_qa_pair(business_id: uuid.UUID, qa_id: uuid.UUID, db: Session = Depends(get_db)):
    qa_pair = db.get(QAPair, qa_id)
    if not qa_pair or qa_pair.business_id != business_id:
        raise HTTPException(status_code=404, detail="Q&A pair not found")
    db.delete(qa_pair)
    db.commit()
