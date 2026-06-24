import time

from google import genai
from google.genai import types
from google.genai.errors import APIError

EMBEDDING_MODELS = ("gemini-embedding-001", "gemini-embedding-2")
EMBEDDING_DIM = 768
BATCH_SIZE = 20
MAX_RETRIES = 5
RETRY_BASE_SECONDS = 1.0

RETRYABLE_STATUS_CODES = {429, 500, 503}


def _embed_config() -> types.EmbedContentConfig:
    return types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM)


def _is_retryable(error: APIError) -> bool:
    return getattr(error, "code", None) in RETRYABLE_STATUS_CODES


def _embed_batch_with_model(
    client: genai.Client, model: str, texts: list[str]
) -> list[list[float]]:
    result = client.models.embed_content(
        model=model,
        contents=texts,
        config=_embed_config(),
    )
    return [list(item.values) for item in result.embeddings]


def embed_texts(client: genai.Client, texts: list[str]) -> list[list[float]]:
    """Embed multiple texts with retries, model fallback, and batching."""
    if not texts:
        return []

    all_embeddings: list[list[float]] = []

    for batch_start in range(0, len(texts), BATCH_SIZE):
        batch = texts[batch_start : batch_start + BATCH_SIZE]
        batch_embeddings = _embed_with_retries(client, batch)
        all_embeddings.extend(batch_embeddings)

    return all_embeddings


def embed_text(client: genai.Client, text: str) -> list[float]:
    return embed_texts(client, [text])[0]


def _embed_with_retries(client: genai.Client, texts: list[str]) -> list[list[float]]:
    last_error: Exception | None = None

    for model in EMBEDDING_MODELS:
        for attempt in range(MAX_RETRIES):
            try:
                return _embed_batch_with_model(client, model, texts)
            except APIError as exc:
                last_error = exc
                if not _is_retryable(exc) or attempt == MAX_RETRIES - 1:
                    break
                delay = RETRY_BASE_SECONDS * (2**attempt)
                time.sleep(delay)

    if last_error is not None:
        raise last_error
    raise RuntimeError("Embedding failed with no error details")
