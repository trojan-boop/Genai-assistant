from sqlalchemy.orm import Session

from database import Document, DocumentChunk
from rag.embed import embed_text


RAG_SYSTEM_INSTRUCTION = (
    "You are a helpful assistant. When document excerpts are provided, "
    "answer using them when relevant. If the answer is not in the excerpts, "
    "say so clearly. Cite sources as [filename, p.N]."
)


def search_similar_chunks(
    db: Session,
    client,
    user_id: str,
    query: str,
    top_k: int = 5,
    document_ids: list[str] | None = None,
) -> list[tuple[DocumentChunk, Document]]:
    query_embedding = embed_text(client, query)

    q = (
        db.query(DocumentChunk, Document)
        .join(Document, DocumentChunk.document_id == Document.id)
        .filter(Document.user_id == user_id)
    )
    if document_ids:
        q = q.filter(Document.id.in_(document_ids))

    rows = (
        q.order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
        .limit(top_k)
        .all()
    )
    return rows


def build_rag_context(
    db: Session,
    client,
    user_id: str,
    query: str,
    document_ids: list[str] | None = None,
    top_k: int = 5,
) -> tuple[str | None, list[dict]]:
    rows = search_similar_chunks(
        db, client, user_id, query, top_k=top_k, document_ids=document_ids
    )
    if not rows:
        return None, []

    parts = []
    sources = []
    for chunk, doc in rows:
        label = f"[{doc.filename}, p.{chunk.page_start}]"
        parts.append(f"{label}\n{chunk.content}")
        sources.append(
            {
                "document_id": doc.id,
                "filename": doc.filename,
                "page": chunk.page_start,
            }
        )

    context = "\n\n---\n\n".join(parts)
    return context, sources
