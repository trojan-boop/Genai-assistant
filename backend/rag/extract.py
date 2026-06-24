from io import BytesIO

from pypdf import PdfReader


def extract_pdf_text(raw: bytes) -> list[tuple[int, str]]:
    """Return (page_number, text) pairs for non-empty pages."""
    reader = PdfReader(BytesIO(raw))
    pages: list[tuple[int, str]] = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            pages.append((i, text))
    return pages
