import uuid

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.embeddings import embed_text
from app.models import Chunk, Document, QAPair

client = OpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = (
    "You are a helpful assistant answering questions on behalf of a business. "
    "Only use the provided context (Q&A pairs and document excerpts) to answer. "
    "If the answer is not contained in the context, say you don't know rather than guessing."
)


def retrieve_relevant_chunks(db: Session, business_id: uuid.UUID, question: str) -> list[Chunk]:
    query_embedding = embed_text(question)
    stmt = (
        select(Chunk)
        .join(Document, Chunk.document_id == Document.id)
        .where(Document.business_id == business_id, Document.status == "ready")
        .order_by(Chunk.embedding.cosine_distance(query_embedding))
        .limit(settings.retrieval_top_k)
    )
    return list(db.execute(stmt).scalars().all())


def retrieve_relevant_qa_pairs(db: Session, business_id: uuid.UUID, question: str) -> list[QAPair]:
    query_embedding = embed_text(question)
    stmt = (
        select(QAPair)
        .where(QAPair.business_id == business_id)
        .order_by(QAPair.embedding.cosine_distance(query_embedding))
        .limit(settings.retrieval_top_k)
    )
    return list(db.execute(stmt).scalars().all())


def build_knowledge_context(
    db: Session, business_id: uuid.UUID, question: str
) -> tuple[str, list[QAPair], list[Chunk]]:
    qa_pairs = retrieve_relevant_qa_pairs(db, business_id, question)
    chunks = retrieve_relevant_chunks(db, business_id, question)

    sections = []
    if qa_pairs:
        qa_block = "\n\n".join(f"Q: {qa.question}\nA: {qa.answer}" for qa in qa_pairs)
        sections.append(f"Q&A:\n{qa_block}")
    if chunks:
        chunk_block = "\n\n---\n\n".join(f"[chunk {c.chunk_index}]\n{c.content}" for c in chunks)
        sections.append(f"Document excerpts:\n{chunk_block}")

    context = "\n\n===\n\n".join(sections)
    return context, qa_pairs, chunks


def answer_question(
    db: Session, business_id: uuid.UUID, question: str
) -> tuple[str, list[QAPair], list[Chunk]]:
    context, qa_pairs, chunks = build_knowledge_context(db, business_id, question)
    user_message = f"Context:\n{context}\n\nQuestion: {question}"

    completion = client.chat.completions.create(
        model=settings.chat_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
    )
    answer = completion.choices[0].message.content or ""
    return answer, qa_pairs, chunks


def lookup_knowledge_tool_result(db: Session, business_id: uuid.UUID, query: str) -> str:
    context, _, _ = build_knowledge_context(db, business_id, query)
    if not context:
        return "No relevant information found in this business's knowledge base."
    return context[:4000]
