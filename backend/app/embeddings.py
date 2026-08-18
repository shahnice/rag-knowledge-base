from openai import OpenAI

from app.config import settings


def embed_texts(texts: list[str], api_key: str) -> list[list[float]]:
    if not texts:
        return []
    client = OpenAI(api_key=api_key)
    response = client.embeddings.create(model=settings.embedding_model, input=texts)
    return [item.embedding for item in response.data]


def embed_text(text: str, api_key: str) -> list[float]:
    return embed_texts([text], api_key)[0]
