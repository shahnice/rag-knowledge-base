from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import Base, engine
from app.routers import browser_call, businesses, calls, chat, documents, qa_pairs, realtime_key

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Call Center Receptionist API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(businesses.router)
app.include_router(documents.router)
app.include_router(qa_pairs.router)
app.include_router(chat.router)
app.include_router(realtime_key.router)
app.include_router(browser_call.router)
app.include_router(calls.router)


@app.get("/health")
def health():
    return {"status": "ok"}
