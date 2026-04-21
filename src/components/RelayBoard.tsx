import { useEffect, useState } from "react";
import { getRevealChains, getRoundLabel } from "../lib/game";
import type { Assignment, Entry, PersistedState, Room } from "../types";
import { DrawingPad } from "./DrawingPad";

interface RelayBoardProps {
  activeRoom: Room;
  assignments: Assignment[];
  entries: Entry[];
  session: PersistedState["sessionsByRoom"][string] | null;
  state: PersistedState;
  submitTextAssignment: (value: string) => void;
}

function submitTextarea(id: string, submit: (value: string) => void) {
  const textarea = document.getElementById(id) as HTMLTextAreaElement | null;
  const value = textarea?.value.trim();
  if (!value || !textarea) {
    return;
  }

  submit(value);
  textarea.value = "";
}

export function RelayBoard({ activeRoom, assignments, entries, session, state, submitTextAssignment }: RelayBoardProps) {
  const pendingAssignment = assignments.find((assignment) => !assignment.currentEntry);
  const revealChains = getRevealChains(state, activeRoom.id);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(revealChains[0]?.starter.id ?? null);

  useEffect(() => {
    if (!selectedChainId || !revealChains.some((chain) => chain.starter.id === selectedChainId)) {
      setSelectedChainId(revealChains[0]?.starter.id ?? null);
    }
  }, [activeRoom.id, revealChains, selectedChainId]);

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
      <section className="panel relay-board">
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
                {chain.starter.displayName} 체인 보기
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
                    <span>{entry.participantName}</span>
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
    <section className="panel relay-board">
      <div className="panel-header">
        <span className="eyebrow">Round {session ? session.currentRound + 1 : 1}</span>
        <h2>{session ? getRoundLabel(session.currentRound) : "릴레이 진행 중"}</h2>
      </div>
      {pendingAssignment ? (
        <div className="task-card">
          {pendingAssignment.kind === "prompt" ? (
            <>
              <p>첫 제시어를 적어 주세요. 재미있는 상상이면 더 좋아요.</p>
              <textarea placeholder="예: 우주에서 라면 먹는 고양이" className="prompt-box" rows={4} id="relay-textarea" />
              <button className="primary-button" onClick={() => submitTextarea("relay-textarea", submitTextAssignment)}>
                제시어 제출
              </button>
            </>
          ) : pendingAssignment.kind === "guess" ? (
            <>
              <p>이전 그림을 보고 무엇인지 추측해 보세요.</p>
              {pendingAssignment.previousEntry ? (
                <img src={pendingAssignment.previousEntry.content} alt="이전 그림" className="task-preview" />
              ) : null}
              <textarea placeholder="무엇처럼 보이는지 적어 주세요" className="prompt-box" rows={4} id="relay-textarea" />
              <button className="primary-button" onClick={() => submitTextarea("relay-textarea", submitTextAssignment)}>
                추측 제출
              </button>
            </>
          ) : (
            <>
              <p>이전 단서를 바탕으로 그림으로 표현해 주세요.</p>
              {pendingAssignment.previousEntry ? <div className="prompt-pill">{pendingAssignment.previousEntry.content}</div> : null}
              <DrawingPad onSubmit={submitTextAssignment} />
            </>
          )}
        </div>
      ) : (
        <div className="empty-board">
          <p>이번 라운드 제출을 마쳤어요. 다른 플레이어를 기다리는 중입니다.</p>
        </div>
      )}
      <div className="submitted-strip">
        <strong>이번 방 제출물</strong>
        <span>{entries.length}개 누적</span>
      </div>
    </section>
  );
}
