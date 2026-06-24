import { Avatar, CopyButton } from "./Atoms";
import { MarkdownText } from "./MarkdownText";

export function MessageRow({ role, text, isStreaming, sources }) {
  return (
    <div className={`msg-row msg-row-${role}`}>
      <Avatar role={role} />
      <div className="msg-col">
        <div className={`bubble bubble-${role}`}>
          <MarkdownText text={text} />
          {isStreaming && <span className="stream-cursor" />}
        </div>
        {role === "ai" && sources?.length > 0 && !isStreaming && (
          <div className="msg-sources">
            {sources.map((s, i) => (
              <span key={i} className="source-chip">
                {s.filename}, p.{s.page}
              </span>
            ))}
          </div>
        )}
        {role === "ai" && text && !isStreaming && <CopyButton text={text} />}
      </div>
    </div>
  );
}
