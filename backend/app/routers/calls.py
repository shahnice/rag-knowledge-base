import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Business, Call
from app.schemas import CallDetailOut, CallOut

router = APIRouter(tags=["calls"])


@router.get("/businesses/{business_id}/calls", response_model=list[CallOut])
def list_calls(business_id: uuid.UUID, db: Session = Depends(get_db)):
    business = db.get(Business, business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return (
        db.query(Call)
        .filter(Call.business_id == business_id)
        .order_by(Call.started_at.desc())
        .all()
    )


@router.get("/calls/{call_id}", response_model=CallDetailOut)
def get_call(call_id: uuid.UUID, db: Session = Depends(get_db)):
    call = db.get(Call, call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call
