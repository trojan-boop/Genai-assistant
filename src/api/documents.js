import { apiFetch } from "./client";

export function listDocuments() {
  return apiFetch("/documents");
}

export function uploadDocument(file) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch("/documents/upload", { method: "POST", body: form });
}

export function deleteDocument(id) {
  return apiFetch(`/documents/${id}`, { method: "DELETE" });
}
