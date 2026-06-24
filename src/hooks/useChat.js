import { useState, useRef, useCallback } from "react";
import { streamMessage, ApiError } from "../api/chat";
import { parseSources } from "../utils/rag";

/**
 * Owns all chat state and the send/stream flow. Extracted from the page
 * component so the component only deals with rendering, and so this logic
 * is unit-testable/reusable on its own.
 */
export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streamingIndex, setStreamingIndex] = useState(null);

  const sessionId = useRef("session-" + Math.random().toString(36).slice(2, 10)).current;

  const sendMessage = useCallback(
    async (rawText, { useDocuments = false } = {}) => {
      const trimmed = rawText.trim();
      if (!trimmed || isLoading) return;

      setError(null);
      setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
      setIsLoading(true);

      try {
        const res = await streamMessage(sessionId, trimmed, { useDocuments });

        let aiMsgIndex;
        setMessages((prev) => {
          aiMsgIndex = prev.length;
          return [...prev, { role: "ai", text: "", sources: null }];
        });
        setStreamingIndex(aiMsgIndex);
        setIsLoading(false);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let aiText = "";
        let receivedAnyChunk = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          aiText += decoder.decode(value, { stream: true });
          receivedAnyChunk = true;

          const { text: displayText } = parseSources(aiText);
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "ai",
              text: displayText,
              sources: updated[updated.length - 1].sources,
            };
            return updated;
          });
        }

        const { text: finalText, sources } = parseSources(aiText);

        if (!receivedAnyChunk) {
          setError("The AI didn't return a response. Try again.");
          setMessages((prev) => prev.slice(0, -1));
        } else {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "ai", text: finalText, sources };
            return updated;
          });
        }
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.detail
            : "Couldn't reach the AI. Check that your backend is running.";
        setError(message);
        setMessages((prev) => (prev[prev.length - 1]?.text === "" ? prev.slice(0, -1) : prev));
      } finally {
        setIsLoading(false);
        setStreamingIndex(null);
      }
    },
    [isLoading, sessionId]
  );

  return { messages, isLoading, error, streamingIndex, sendMessage, sessionId };
}
