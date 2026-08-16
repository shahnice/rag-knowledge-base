import asyncio
import base64
import json
import logging
from datetime import datetime
from typing import Awaitable, Callable, Literal

import websockets
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Business, Call
from app.realtime.tools import TOOL_DEFINITIONS, execute_tool
from app.realtime.transcript import append_turn

logger = logging.getLogger(__name__)

AudioFormat = Literal["g711_ulaw", "pcm16"]

# Bytes per millisecond of audio, used to convert bytes-of-audio-generated into the
# audio_end_ms that conversation.item.truncate expects. g711_ulaw is 8000 samples/sec
# at 1 byte/sample; pcm16 is settings.browser_call_sample_rate samples/sec at 2 bytes/sample.
_BYTES_PER_MS = {"g711_ulaw": 8, "pcm16": settings.browser_call_sample_rate * 2 // 1000}

SYSTEM_PREAMBLE = (
    "You are an AI phone receptionist for {business_name}. "
    "Always call the lookup_knowledge tool before answering questions about products, "
    "policies, pricing, hours, or support -- never guess or make up information. "
    "If lookup_knowledge doesn't return a relevant answer, say you don't know and offer "
    "to have someone follow up. Keep responses short and conversational, like a real phone call. "
    "Call the end_call tool once the conversation is naturally over."
)


def _audio_format_config(audio_format: AudioFormat) -> dict:
    if audio_format == "g711_ulaw":
        return {"type": "audio/pcmu"}
    return {"type": "audio/pcm", "rate": settings.browser_call_sample_rate}


class CallEngine:
    """Transport-agnostic bridge between a caller's audio and an OpenAI Realtime session.

    Adapters (Twilio, browser) only ever call push_caller_audio() and implement the
    on_audio_out/on_interrupt/on_call_end callbacks -- this class has no knowledge of
    Twilio or browsers.
    """

    def __init__(
        self,
        business: Business,
        call: Call,
        db: Session,
        openai_api_key: str,
        audio_format: AudioFormat,
        on_audio_out: Callable[[bytes], Awaitable[None]],
        on_interrupt: Callable[[], Awaitable[None]],
        on_call_end: Callable[[], Awaitable[None]],
    ):
        self.business = business
        self.call = call
        self.db = db
        self.openai_api_key = openai_api_key
        self.audio_format = audio_format
        self.on_audio_out = on_audio_out
        self.on_interrupt = on_interrupt
        self.on_call_end = on_call_end

        self._ws = None
        self._recv_task: asyncio.Task | None = None
        self._closed = False

        self._last_assistant_item_id: str | None = None
        self._response_audio_bytes = 0
        self._pending_end_call = False

    async def start(self) -> None:
        url = f"wss://api.openai.com/v1/realtime?model={settings.openai_realtime_model}"
        self._ws = await websockets.connect(
            url,
            additional_headers={"Authorization": f"Bearer {self.openai_api_key}"},
        )

        instructions = SYSTEM_PREAMBLE.format(business_name=self.business.name)
        if self.business.persona_instructions:
            instructions += f"\n\nBusiness-specific guidance:\n{self.business.persona_instructions}"

        audio_format = _audio_format_config(self.audio_format)
        await self._send(
            {
                "type": "session.update",
                "session": {
                    "type": "realtime",
                    "model": settings.openai_realtime_model,
                    "instructions": instructions,
                    "output_modalities": ["audio"],
                    "audio": {
                        "input": {
                            "format": audio_format,
                            "turn_detection": {"type": "server_vad"},
                            "transcription": {"model": "whisper-1"},
                        },
                        "output": {
                            "format": audio_format,
                            "voice": self.business.voice,
                        },
                    },
                    "tools": TOOL_DEFINITIONS,
                },
            }
        )

        await self._send(
            {
                "type": "response.create",
                "response": {
                    "instructions": f"Greet the caller with exactly: {self.business.greeting}"
                },
            }
        )

        self._recv_task = asyncio.create_task(self._recv_loop())

    async def push_caller_audio(self, chunk: bytes) -> None:
        if not self._ws:
            return
        await self._send(
            {"type": "input_audio_buffer.append", "audio": base64.b64encode(chunk).decode("ascii")}
        )

    async def stop(self) -> None:
        if self._closed:
            return
        self._closed = True
        if self._recv_task:
            self._recv_task.cancel()
        if self._ws:
            await self._ws.close()
        if self.call.status == "in_progress":
            self.call.status = "completed"
            self.call.ended_at = datetime.utcnow()
            self.db.commit()

    async def _send(self, event: dict) -> None:
        if not self._ws:
            return
        await self._ws.send(json.dumps(event))

    async def _recv_loop(self) -> None:
        try:
            async for raw in self._ws:
                try:
                    event = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                await self._handle_event(event)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Realtime receive loop failed for call %s", self.call.id)
            await self.on_call_end()

    async def _handle_event(self, event: dict) -> None:
        event_type = event.get("type")

        if event_type == "response.output_audio.delta":
            item_id = event.get("item_id")
            if item_id and item_id != self._last_assistant_item_id:
                self._last_assistant_item_id = item_id
                self._response_audio_bytes = 0
            chunk = base64.b64decode(event["delta"])
            self._response_audio_bytes += len(chunk)
            await self.on_audio_out(chunk)

        elif event_type == "input_audio_buffer.speech_started":
            await self._handle_barge_in()

        elif event_type == "conversation.item.input_audio_transcription.completed":
            append_turn(self.db, self.call.id, "caller", event.get("transcript", ""))

        elif event_type == "response.output_audio_transcript.done":
            append_turn(self.db, self.call.id, "assistant", event.get("transcript", ""))

        elif event_type == "response.output_item.done":
            item = event.get("item", {})
            if item.get("type") == "function_call":
                await self._handle_tool_call(item)

        elif event_type == "response.done":
            if self._pending_end_call:
                self._pending_end_call = False
                await self.on_call_end()

        elif event_type == "error":
            logger.error("Realtime API error on call %s: %s", self.call.id, event.get("error"))

    async def _handle_barge_in(self) -> None:
        if self._last_assistant_item_id is None:
            await self.on_interrupt()
            return

        audio_end_ms = self._response_audio_bytes // _BYTES_PER_MS[self.audio_format]
        await self._send(
            {
                "type": "conversation.item.truncate",
                "item_id": self._last_assistant_item_id,
                "content_index": 0,
                "audio_end_ms": max(audio_end_ms, 0),
            }
        )
        await self.on_interrupt()
        self._last_assistant_item_id = None
        self._response_audio_bytes = 0

    async def _handle_tool_call(self, item: dict) -> None:
        name = item.get("name", "")
        call_id = item.get("call_id", "")
        try:
            arguments = json.loads(item.get("arguments") or "{}")
        except json.JSONDecodeError:
            arguments = {}

        append_turn(self.db, self.call.id, "tool", f"{name}({arguments})")

        result = await asyncio.to_thread(execute_tool, self.db, self.business.id, name, arguments)

        await self._send(
            {
                "type": "conversation.item.create",
                "item": {"type": "function_call_output", "call_id": call_id, "output": result},
            }
        )
        await self._send({"type": "response.create"})

        if name == "end_call":
            self._pending_end_call = True
