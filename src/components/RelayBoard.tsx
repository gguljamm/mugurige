import { useEffect, useRef, useState } from "react";
import { getRevealChains, getRoundLabel } from "../lib/game";
import type { Assignment, PersistedState, Room } from "../types";
import { DrawingPad, type DrawingPadHandle } from "./DrawingPad";

interface RelayBoardProps {
  activeRoom: Room;
  assignments: Assignment[];
  currentUserId?: string | null;
  isFullscreenPlay?: boolean;
  session: PersistedState["sessionsByRoom"][string] | null;
  state: PersistedState;
  submitTextAssignment: (value: string) => void;
}

export function RelayBoard({
  activeRoom,
  assignments,
  currentUserId = null,
  isFullscreenPlay = false,
  session,
  state,
  submitTextAssignment,
}: RelayBoardProps) {
  const activeAssignment =
    session?.currentRound === 0
      ? assignments[0]
      : assignments.find((assignment) => !assignment.currentEntry) ?? assignments[0];
  const activeAssignmentKey = activeAssignment ? `${activeAssignment.chainId}:${activeAssignment.round}` : null;
  const activeAssignmentKind = activeAssignment?.kind ?? null;
  const activeAssignmentCurrentContent = activeAssignment?.currentEntry?.content ?? "";
  const activeAssignmentHasCurrentEntry = Boolean(activeAssignment?.currentEntry);
  const stageExpiresAt = session ? session.stageStartedAt + session.stageDurationSec * 1000 : 0;
  const revealChains = getRevealChains(state, activeRoom.id);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(currentUserId ?? revealChains[0]?.starter.id ?? null);
  const [remainingSec, setRemainingSec] = useState<number>(session?.stageDurationSec ?? 0);
  const [textDraft, setTextDraft] = useState("");
  const autoSubmittedStageRef = useRef<string | null>(null);
  const drawingPadRef = useRef<DrawingPadHandle | null>(null);

  useEffect(() => {
    if (!selectedChainId || !revealChains.some((chain) => chain.starter.id === selectedChainId)) {
      setSelectedChainId(currentUserId ?? revealChains[0]?.starter.id ?? null);
    }
  }, [activeRoom.id, currentUserId, revealChains, selectedChainId]);

  useEffect(() => {
    if (!session) {
      setRemainingSec(0);
      return undefined;
    }

    const update = () => {
      const expiresAt = session.stageStartedAt + session.stageDurationSec * 1000;
      setRemainingSec(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };

    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    autoSubmittedStageRef.current = null;
    setTextDraft(activeAssignmentKind === "guess" ? activeAssignmentCurrentContent : "");
    if (!activeAssignmentKey) {
      return;
    }
  }, [activeAssignmentCurrentContent, activeAssignmentKey, activeAssignmentKind]);

  useEffect(() => {
    if (!activeAssignmentKey || !activeAssignmentKind || activeAssignmentHasCurrentEntry || !session) {
      return;
    }

    if (Date.now() < stageExpiresAt) {
      return;
    }

    if (autoSubmittedStageRef.current === activeAssignmentKey) {
      return;
    }

    autoSubmittedStageRef.current = activeAssignmentKey;
    if (activeAssignmentKind === "guess") {
      submitTextAssignment(textDraft);
      return;
    }

    if (activeAssignmentKind === "drawing") {
      drawingPadRef.current?.submit();
    }
  }, [
    activeAssignmentHasCurrentEntry,
    activeAssignmentKey,
    activeAssignmentKind,
    remainingSec,
    session,
    stageExpiresAt,
    submitTextAssignment,
    textDraft,
  ]);

  if (activeRoom.status === "lobby") {
    return (
      <section className="panel relay-board empty-board">
        <h3>릴레이 모드 준비 중</h3>
        <p>게임을 시작하면 참가자마다 제시어가 생성되고, 그림과 추측이 차례대로 이어집니다.</p>
      </section>
    );
  }

  if (activeRoom.status === "results") {
    const selectedChain = revealChains.find((chain) => chain.starter.id === selectedChainId) ?? revealChains[0];

    return (
      <section className="panel relay-board relay-board-results">
        <div className="panel-header">
          <span className="eyebrow">Post Game</span>
          <h2>이전 이미지와 답변 내역 보기</h2>
        </div>
        <div className="history-layout">
          <div className="history-list">
            {revealChains.map((chain) => (
              <button
                key={chain.starter.id}
                className={`history-chain-button ${selectedChain?.starter.id === chain.starter.id ? "active" : ""}`}
                onClick={() => setSelectedChainId(chain.starter.id)}
              >
                {chain.starter.displayName}
                {chain.starter.id === currentUserId ? <span className="history-self-badge">내 기록</span> : null}
              </button>
            ))}
          </div>
          <div className="reveal-grid reveal-grid-single">
            {selectedChain ? (
              <article key={selectedChain.starter.id} className="reveal-card">
                <h3>{selectedChain.starter.displayName} 체인</h3>
                {selectedChain.entries.map((entry) => (
                  <button key={entry.id} className="reveal-step reveal-step-button">
                    <strong>
                      Round {entry.round + 1} · {getRoundLabel(entry.round)}
                    </strong>
                    <span className="reveal-step-author">{entry.participantName}</span>
                    {entry.kind === "drawing" ? (
                      <img src={entry.content} alt={`${entry.participantName} 그림`} />
                    ) : (
                      <p>{entry.content}</p>
                    )}
                  </button>
                ))}
              </article>
            ) : (
              <article className="reveal-card">
                <p>아직 확인할 기록이 없어요.</p>
              </article>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {session ? (
        <div className="countdown-floating">
          <div className={`countdown-chip ${remainingSec <= 5 ? "countdown-chip-urgent" : ""}`}>
            남은 시간 {remainingSec}초
          </div>
        </div>
      ) : null}
      <section className={`panel relay-board ${isFullscreenPlay ? "relay-board-playing" : ""}`}>
      <div className="panel-header">
        <span className="eyebrow">Stage {session ? session.currentRound : 1}</span>
        <h2>{session ? getRoundLabel(session.currentRound) : "릴레이 진행 중"}</h2>
      </div>
      {activeAssignment ? (
        <div className="task-card">
          {activeAssignment.kind === "prompt" ? (
            <div className="prompt-stage">
              <p>전달받은 제시어를 확인하는 단계예요. 5초 뒤 자동으로 다음 스테이지로 넘어갑니다.</p>
              {(activeAssignment.currentEntry ?? activeAssignment.previousEntry) ? (
                <div className="prompt-stage-word">{(activeAssignment.currentEntry ?? activeAssignment.previousEntry)?.content}</div>
              ) : null}
            </div>
          ) : activeAssignment.kind === "guess" ? (
            <div className="guess-stage">
              <p>넘어온 그림을 보고 제시어를 맞춰 보세요.</p>
              {activeAssignment.previousEntry ? (
                <img src={activeAssignment.previousEntry.content} alt="이전 그림" className="task-preview" />
              ) : null}
              <textarea
                value={textDraft}
                onChange={(event) => setTextDraft(event.target.value)}
                placeholder="이 그림을 한 단어 또는 짧은 문장으로 표현해 주세요"
                className="prompt-box"
                rows={4}
              />
            </div>
          ) : (
            <>
              <p>넘어온 단서를 보고 그림으로 표현해 주세요.</p>
              {activeAssignment.previousEntry ? <div className="prompt-pill">{activeAssignment.previousEntry.content}</div> : null}
              <DrawingPad
                ref={drawingPadRef}
                key={`${activeAssignment.chainId}-${activeAssignment.round}`}
                onSubmit={submitTextAssignment}
              />
            </>
          )}
        </div>
      ) : (
        <div className="empty-board">
          <p>다음 스테이지로 이동 중입니다.</p>
        </div>
      )}
      </section>
    </>
  );
}
