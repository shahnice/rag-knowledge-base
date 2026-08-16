import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Business, Call
from app.realtime.engine import CallEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calls", tags=["calls"])


@router.websocket("/browser/{business_id}")
async def browser_call(websocket: WebSocket, business_id: uuid.UUID, db: Session = Depends(get_db)):
    await websocket.accept()

    business = db.get(Business, business_id)
    if not business:
        await websocket.send_json({"type": "error", "message": "Business not found"})
        await websocket.close()
        return

    try:
        first_raw = await websocket.receive_text()
        first_message = json.loads(first_raw)
    except Exception:
        await websocket.send_json({"type": "error", "message": "Expected a JSON start message"})
        await websocket.close()
        return

    openai_api_key = (first_message.get("openai_api_key") or "").strip()
    if first_message.get("type") != "start" or not openai_api_key:
        await websocket.send_json(
            {
                "type": "error",
                "message": "First message must be {type: 'start', openai_api_key: '...'}",
            }
        )
        await websocket.close()
        return

    call = Call(business_id=business_id, channel="browser")
    db.add(call)
    db.commit()
    db.refresh(call)

    main_task = asyncio.current_task()

    async def on_audio_out(chunk: bytes) -> None:
        try:
            await websocket.send_bytes(chunk)
        except Exception:
            pass

    async def on_interrupt() -> None:
        try:
            await websocket.send_json({"type": "interrupt"})
        except Exception:
            pass

    async def on_call_end() -> None:
        if main_task:
            main_task.cancel()

    engine = CallEngine(
        business=business,
        call=call,
        db=db,
        openai_api_key=openai_api_key,
        audio_format="pcm16",
        on_audio_out=on_audio_out,
        on_interrupt=on_interrupt,
        on_call_end=on_call_end,
    )

    try:
        await engine.start()
    except Exception as err:
        logger.exception("Failed to start realtime session for call %s", call.id)
        call.status = "failed"
        db.commit()
        await websocket.send_json({"type": "error", "message": f"Failed to start voice session: {err}"})
        await websocket.close()
        return

    await websocket.send_json({"type": "ready", "call_id": str(call.id)})

    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
            if message.get("bytes") is not None:
                await engine.push_caller_audio(message["bytes"])
            elif message.get("text") is not None:
                try:
                    control = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue
                if control.get("type") == "stop":
                    break
    except (asyncio.CancelledError, WebSocketDisconnect):
        pass
    finally:
        await engine.stop()
        try:
            await websocket.send_json({"type": "ended", "call_id": str(call.id)})
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass
