from fastapi import FastAPI, Depends, HTTPException, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from google import genai
from google.genai import types
from dotenv import load_dotenv
import json
import logging
import os

from database import init_db, get_db, ChatSession, Message, User, Document, DocumentChunk
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    COOKIE_NAME,
    TOKEN_EXPIRE_MINUTES,
)
from rag.extract import extract_pdf_text
from rag.chunk import chunk_pages
from rag.embed import embed_texts
from rag.retrieve import build_rag_context, RAG_SYSTEM_INSTRUCTION
from google.genai.errors import APIError

load_dotenv()

logger = logging.getLogger(__name__)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_NAME = "gemini-3.5-flash"
MAX_PDF_BYTES = 10 * 1024 * 1024

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str


@app.post("/signup", response_model=UserOut)
def signup(req: SignupRequest, response: Response, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(email=req.email, hashed_password=hash_password(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    return UserOut(id=user.id, email=user.email)


@app.post("/login", response_model=UserOut)
def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    return UserOut(id=user.id, email=user.email)


@app.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"detail": "Logged out"}


@app.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut(id=current_user.id, email=current_user.email)


# ---------------------------------------------------------------------------
# Document library — user-wide, text-only (PDF discarded after extraction)
# ---------------------------------------------------------------------------

class DocumentOut(BaseModel):
    id: str
    filename: str
    page_count: int | None
    status: str
    created_at: str


def document_to_out(doc: Document) -> DocumentOut:
    return DocumentOut(
        id=doc.id,
        filename=doc.filename,
        page_count=doc.page_count,
        status=doc.status,
        created_at=doc.created_at.isoformat() if doc.created_at else "",
    )


@app.get("/documents", response_model=list[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return [document_to_out(d) for d in docs]


@app.post("/documents/upload", response_model=DocumentOut)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    raw = await file.read()
    if len(raw) > MAX_PDF_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")
    if not raw.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Invalid PDF file")

    try:
        pages = extract_pdf_text(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF")

    if not pages:
        raise HTTPException(status_code=400, detail="No text found in PDF")

    doc = Document(
        user_id=current_user.id,
        filename=file.filename,
        page_count=len(pages),
        status="ready",
    )
    db.add(doc)
    db.flush()

    try:
        chunks = chunk_pages(pages)
        embeddings = embed_texts(client, [c.content for c in chunks])
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            db.add(
                DocumentChunk(
                    document_id=doc.id,
                    chunk_index=i,
                    content=chunk.content,
                    page_start=chunk.page_start,
                    page_end=chunk.page_end,
                    embedding=embedding,
                )
            )
        db.commit()
    except APIError as exc:
        db.rollback()
        logger.exception("Document upload failed for %s", file.filename)
        if getattr(exc, "code", None) in {429, 503}:
            raise HTTPException(
                status_code=503,
                detail="Embedding service is busy. Please wait a moment and try again.",
            ) from exc
        raise HTTPException(status_code=500, detail="Failed to process document") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Document upload failed for %s", file.filename)
        raise HTTPException(status_code=500, detail="Failed to process document") from exc

    db.refresh(doc)
    return document_to_out(doc)


@app.delete("/documents/{document_id}")
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.get(Document, document_id)
    if doc is None or doc.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    db.delete(doc)
    db.commit()
    return {"detail": "Deleted"}


# ---------------------------------------------------------------------------
# Chat routes
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    session_id: str
    message: str
    use_documents: bool = False
    document_ids: list[str] | None = None


def get_or_create_session(db: Session, session_id: str, user_id: str) -> ChatSession:
    session = db.get(ChatSession, session_id)
    if session is None:
        session = ChatSession(id=session_id, user_id=user_id)
        db.add(session)
        db.commit()
        db.refresh(session)
    elif session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your session")
    return session


def load_history_as_contents(session: ChatSession):
    return [{"role": m.role, "parts": [{"text": m.text}]} for m in session.messages]


def save_message(db: Session, session_id: str, role: str, text: str):
    db.add(Message(session_id=session_id, role=role, text=text))
    db.commit()


def build_generation_config(context: str | None):
    if not context:
        return None
    instruction = (
        f"{RAG_SYSTEM_INSTRUCTION}\n\n"
        f"Document excerpts:\n---\n{context}\n---"
    )
    return types.GenerateContentConfig(system_instruction=instruction)


@app.post("/chat")
def chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = get_or_create_session(db, req.session_id, current_user.id)
    contents = load_history_as_contents(session)
    contents.append({"role": "user", "parts": [{"text": req.message}]})

    context = None
    if req.use_documents:
        context, _ = build_rag_context(
            db, client, current_user.id, req.message, req.document_ids
        )

    config = build_generation_config(context)
    response = client.models.generate_content(
        model=MODEL_NAME, contents=contents, config=config
    )

    save_message(db, req.session_id, "user", req.message)
    save_message(db, req.session_id, "model", response.text)

    return {"response": response.text}


@app.post("/chat/stream")
def chat_stream(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = get_or_create_session(db, req.session_id, current_user.id)
    contents = load_history_as_contents(session)
    contents.append({"role": "user", "parts": [{"text": req.message}]})

    context = None
    sources: list[dict] = []
    if req.use_documents:
        context, sources = build_rag_context(
            db, client, current_user.id, req.message, req.document_ids
        )

    config = build_generation_config(context)

    def event_generator():
        full_reply = ""
        stream = client.models.generate_content_stream(
            model=MODEL_NAME, contents=contents, config=config
        )
        for chunk in stream:
            if chunk.text:
                full_reply += chunk.text
                yield chunk.text

        save_message(db, req.session_id, "user", req.message)
        save_message(db, req.session_id, "model", full_reply)

        if sources:
            yield f"\n\n<!--SOURCES:{json.dumps(sources)}-->"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/chat/{session_id}")
def get_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.get(ChatSession, session_id)
    if session is None or session.user_id != current_user.id:
        return {"history": []}
    return {"history": [{"role": m.role, "text": m.text} for m in session.messages]}
