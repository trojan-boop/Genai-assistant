const SOURCES_RE = /\n\n<!--SOURCES:(\[.*?\])-->$/s;

export function parseSources(text) {
  const match = text.match(SOURCES_RE);
  if (!match) return { text, sources: null };
  try {
    return { text: text.replace(SOURCES_RE, ""), sources: JSON.parse(match[1]) };
  } catch {
    return { text: text.replace(SOURCES_RE, ""), sources: null };
  }
}
