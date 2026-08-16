import uuid

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.embeddings import embed_text
from app.models import Chunk

client = OpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = (
    "You are a helpful assistant answering questions about a specific document. "
    "Only use the provided context to answer. If the answer is not contained in the "
    "context, say you don't know rather than guessing."
)


def retrieve_relevant_chunks(db: Session, document_id: uuid.UUID, question: str) -> list[Chunk]:
    query_embedding = embed_text(question)
    stmt = (
        select(Chunk)
        .where(Chunk.document_id == document_id)
        .order_by(Chunk.embedding.cosine_distance(query_embedding))
        .limit(settings.retrieval_top_k)
    )
    return list(db.execute(stmt).scalars().all())


def answer_question(db: Session, document_id: uuid.UUID, question: str) -> tuple[str, list[Chunk]]:
    chunks = retrieve_relevant_chunks(db, document_id, question)

    context = "\n\n---\n\n".join(f"[chunk {c.chunk_index}]\n{c.content}" for c in chunks)
    user_message = f"Context:\n{context}\n\nQuestion: {question}"

    completion = client.chat.completions.create(
        model=settings.chat_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
    )
    answer = completion.choices[0].message.content or ""
    return answer, chunks
