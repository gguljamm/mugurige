import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";

interface ChatPanelProps {
  composer: string;
  currentUserId?: string | null;
  isOpen?: boolean;
  messages: ChatMessage[];
  onChangeComposer: (value: string) => void;
  onClose?: () => void;
  onSend: () => void;
}

export function ChatPanel({
  composer,
  currentUserId,
  isOpen = true,
  messages,
  onChangeComposer,
  onClose,
  onSend,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [isOpen, messages]);

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <h2>실시간 채팅</h2>
        {onClose ? (
          <button className="ghost-button chat-close-button" onClick={onClose} aria-label="채팅 닫기">
            ×
          </button>
        ) : null}
      </div>
      <div className="chat-list">
        {messages.map((message) => {
          const isNotice = message.authorId === "system" || message.authorName === "Mugurige";
          const isMine = !isNotice && message.authorId === currentUserId;

          return (
            <div
              key={message.id}
              className={`chat-message ${isNotice ? "system" : ""} ${isMine ? "mine" : ""}`}
            >
              <strong>{message.authorName}</strong>
              <p>{message.content}</p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="chat-composer">
        <input
          value={composer}
          onChange={(event) => onChangeComposer(event.target.value)}
          placeholder="메시지를 입력하세요"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing && !event.repeat) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <button className="primary-button" onClick={onSend}>
          전송
        </button>
      </div>
    </section>
  );
}
