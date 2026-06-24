import { useState } from "react";
import { UserIcon, SparkIcon, CopyIcon, CheckIcon } from "./icons";

export function Avatar({ role }) {
  return (
    <div className={`avatar avatar-${role}`}>
      {role === "user" ? <UserIcon /> : <SparkIcon />}
    </div>
  );
}

export function TypingDots() {
  return (
    <div className="typing-dots" aria-label="AI is typing">
      <span />
      <span />
      <span />
    </div>
  );
}

export function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — fail silently */
    }
  };

  return (
    <button className="copy-btn" onClick={handleCopy} aria-label="Copy message">
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
