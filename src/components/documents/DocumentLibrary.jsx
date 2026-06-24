import { useState, useRef, useCallback, useEffect } from "react";
import { listDocuments, uploadDocument, deleteDocument } from "../../api/documents";
import { ApiError } from "../../api/client";

export function DocumentLibrary({ useDocuments, onUseDocumentsChange }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await listDocuments();
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const doc = await uploadDocument(file);
      setDocuments((prev) => [doc, ...prev]);
      onUseDocumentsChange(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    setError(null);
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Delete failed");
    }
  };

  const hasDocuments = documents.length > 0;

  return (
    <div className="doc-library">
      <div className="doc-library-header">
        <span className="doc-library-title">My documents</span>
        <button
          type="button"
          className="doc-upload-btn"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "Upload PDF"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={handleUpload}
        />
      </div>

      <label className={`doc-toggle ${!hasDocuments ? "doc-toggle-disabled" : ""}`}>
        <input
          type="checkbox"
          checked={useDocuments && hasDocuments}
          disabled={!hasDocuments}
          onChange={(e) => onUseDocumentsChange(e.target.checked)}
        />
        <span>Use my documents in chat</span>
      </label>

      {error && <p className="doc-error">{error}</p>}

      <div className="doc-list">
        {loading && <p className="doc-empty">Loading…</p>}
        {!loading && documents.length === 0 && (
          <p className="doc-empty">Upload a PDF to chat with your documents.</p>
        )}
        {documents.map((doc) => (
          <div key={doc.id} className="doc-item">
            <div className="doc-item-info">
              <span className="doc-filename">{doc.filename}</span>
              <span className="doc-meta">
                {doc.page_count != null ? `${doc.page_count} pages` : ""}
              </span>
            </div>
            <button
              type="button"
              className="doc-delete-btn"
              onClick={() => handleDelete(doc.id)}
              aria-label={`Delete ${doc.filename}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
