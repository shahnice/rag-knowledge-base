from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import APIError, AuthenticationError

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


@app.exception_handler(AuthenticationError)
def handle_openai_auth_error(request: Request, exc: AuthenticationError):
    return JSONResponse(status_code=401, content={"detail": "Invalid OpenAI API key"})


@app.exception_handler(APIError)
def handle_openai_api_error(request: Request, exc: APIError):
    return JSONResponse(status_code=502, content={"detail": f"OpenAI API error: {exc.message}"})

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
