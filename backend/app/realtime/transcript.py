import uuid

from sqlalchemy.orm import Session

from app.models import CallTurn


def append_turn(db: Session, call_id: uuid.UUID, role: str, content: str) -> None:
    if not content.strip():
        return
    db.add(CallTurn(call_id=call_id, role=role, content=content))
    db.commit()
