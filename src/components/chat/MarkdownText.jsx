// Tiny markdown renderer — bold, bullet lists, inline code. No dependency.

function renderInline(text, keyPrefix) {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code key={`${keyPrefix}-${i}`} className="inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

export function MarkdownText({ text }) {
  const lines = text.split("\n");
  const blocks = [];
  let listBuffer = [];

  const flushList = (key) => {
    if (listBuffer.length) {
      blocks.push(
        <ul className="msg-list" key={`list-${key}`}>
          {listBuffer}
        </ul>
      );
      listBuffer = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      listBuffer.push(
        <li key={i} className="msg-list-item">
          {renderInline(trimmed.slice(2), i)}
        </li>
      );
      return;
    }
    flushList(i);
    if (trimmed === "") return;
    blocks.push(<p key={i}>{renderInline(line, i)}</p>);
  });
  flushList("end");

  return <>{blocks}</>;
}
