from dataclasses import dataclass


@dataclass
class TextChunk:
    content: str
    page_start: int
    page_end: int


def chunk_pages(
    pages: list[tuple[int, str]],
    chunk_size: int = 1000,
    overlap: int = 200,
) -> list[TextChunk]:
    """Split page text into overlapping chunks while preserving page references."""
    if chunk_size <= overlap:
        raise ValueError("chunk_size must be greater than overlap")

    chunks: list[TextChunk] = []
    for page_num, text in pages:
        if len(text) <= chunk_size:
            chunks.append(TextChunk(content=text, page_start=page_num, page_end=page_num))
            continue

        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            piece = text[start:end].strip()
            if piece:
                chunks.append(TextChunk(content=piece, page_start=page_num, page_end=page_num))
            if end >= len(text):
                break
            start = end - overlap

    return chunks
