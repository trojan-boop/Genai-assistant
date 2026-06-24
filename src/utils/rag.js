const SOURCES_RE = /\n\n<!--SOURCES:(\[.*?\])-->$/s;
const ERROR_RE = /\n\n<!--ERROR:(.*?)-->$/s;

export function parseSources(text) {
  const errorMatch = text.match(ERROR_RE);
  if (errorMatch) {
    return { text: text.replace(ERROR_RE, ""), sources: null, error: errorMatch[1] };
  }

  const match = text.match(SOURCES_RE);
  if (!match) return { text, sources: null, error: null };
  try {
    return {
      text: text.replace(SOURCES_RE, ""),
      sources: JSON.parse(match[1]),
      error: null,
    };
  } catch {
    return { text: text.replace(SOURCES_RE, ""), sources: null, error: null };
  }
}
