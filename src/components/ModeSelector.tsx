import { modeCards } from "../lib/game";
import type { GameMode } from "../types";

interface ModeSelectorProps {
  onSelectMode?: (mode: GameMode) => void;
}

export function ModeSelector({ onSelectMode }: ModeSelectorProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <span className="eyebrow">Game Modes</span>
        <h2>오늘은 어떤 상상을 이어볼까요?</h2>
      </div>
      <div className="mode-grid">
        {modeCards.map((mode) => (
          <article key={mode.id} className={`mode-card ${mode.enabled ? "enabled" : "disabled"}`}>
            <span className="mode-badge">{mode.badge}</span>
            <h3>{mode.title}</h3>
            <strong>{mode.subtitle}</strong>
            <p>{mode.description}</p>
            <button
              className={mode.enabled ? "primary-button" : "secondary-button"}
              disabled={!mode.enabled}
              onClick={() => {
                if (mode.enabled) {
                  onSelectMode?.(mode.id);
                }
              }}
            >
              {mode.enabled ? "이 모드로 방 만들기" : "곧 만나요"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
