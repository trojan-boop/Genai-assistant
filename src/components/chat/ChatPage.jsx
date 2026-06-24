import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../hooks/useChat";
import { DocumentLibrary } from "../documents/DocumentLibrary";
import { MessageRow } from "./MessageRow";
import { TypingDots, Avatar } from "./Atoms";
import { SparkIcon, SendIcon, ErrorIcon, LogoutIcon } from "./icons";

const SUGGESTIONS = [
  "Explain this like I'm new to the topic",
  "What's the difference between a noun and a verb?",
  "Give me 3 practice examples",
];

export function ChatPage() {
  const { user, logout } = useAuth();
  const { messages, isLoading, error, streamingIndex, sendMessage } = useChat();
  const [input, setInput] = useState("");
  const [useDocuments, setUseDocuments] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [input, autoResize]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input, { useDocuments });
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-shell">
        <header className="chat-header">
          <div className="chat-header-left">
            <div className="header-icon">
              <SparkIcon />
            </div>
            <div>
              <h1>GenAI Assistant</h1>
              <div className="status-line">
                <span className="status-dot" />
                <p>Online · Gemini</p>
              </div>
            </div>
          </div>
          <div className="chat-header-right">
            {user && <span className="user-email">{user.email}</span>}
            <button className="logout-btn" onClick={logout} aria-label="Log out">
              <LogoutIcon />
            </button>
          </div>
        </header>

        <div className="chat-body">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                <SparkIcon size={22} />
              </div>
              <p className="empty-title">How can I help today?</p>
              <p className="empty-sub">Ask anything — grammar, code, ideas, explanations.</p>
              <div className="suggestion-row">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="suggestion-chip"
                    onClick={() => {
                      setInput(s);
                      inputRef.current?.focus();
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageRow
              key={i}
              role={m.role}
              text={m.text}
              sources={m.sources}
              isStreaming={streamingIndex === i}
            />
          ))}

          {isLoading && (
            <div className="msg-row msg-row-ai">
              <Avatar role="ai" />
              <div className="bubble bubble-ai bubble-loading">
                <TypingDots />
              </div>
            </div>
          )}

          {error && (
            <div className="error-banner">
              <ErrorIcon />
              <span>{error}</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <DocumentLibrary
          useDocuments={useDocuments}
          onUseDocumentsChange={setUseDocuments}
        />

        <div className="chat-input-area">
          <div className="input-wrap">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message GenAI Assistant…"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              className="send-btn"
            >
              <SendIcon />
            </button>
          </div>
          <p className="input-hint">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
