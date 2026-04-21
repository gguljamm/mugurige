import type { ChatMessage } from "../types";

interface ChatPanelProps {
  composer: string;
  messages: ChatMessage[];
  onChangeComposer: (value: string) => void;
  onSend: () => void;
}

export function ChatPanel({ composer, messages, onChangeComposer, onSend }: ChatPanelProps) {
  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <span className="eyebrow">Live Chat</span>
        <h2>실시간 채팅</h2>
      </div>
      <div className="chat-list">
        {messages.map((message) => (
          <div key={message.id} className={`chat-message ${message.authorId === "system" ? "system" : ""}`}>
            <strong>{message.authorName}</strong>
            <p>{message.content}</p>
          </div>
        ))}
      </div>
      <div className="chat-composer">
        <input
          value={composer}
          onChange={(event) => onChangeComposer(event.target.value)}
          placeholder="메시지를 입력하세요"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
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
