import type { Participant, PromptDifficulty, Room, UserProfile } from "../types";

interface RoomPanelProps {
  activeRoom: Room | null;
  currentUser: UserProfile | null;
  participants: Participant[];
  onAddAiParticipant: () => void;
  onCopyInviteLink?: () => void;
  onLeaveRoom: () => void;
  onReplayRoom?: () => void;
  onStartGame: () => void;
  onUpdatePromptDifficulty: (difficulty: PromptDifficulty) => void;
}

export function RoomPanel({
  activeRoom,
  currentUser,
  participants,
  onAddAiParticipant,
  onCopyInviteLink,
  onLeaveRoom,
  onReplayRoom,
  onStartGame,
  onUpdatePromptDifficulty,
}: RoomPanelProps) {
  if (!activeRoom) {
    return (
      <section className="panel room-panel empty-board">
        <h3>방에 들어가면 여기서 준비 상황을 볼 수 있어요</h3>
        <p>초대 코드로 친구들을 모으고, AI 참가자도 추가해 보세요.</p>
      </section>
    );
  }

  const isHost = currentUser?.id === activeRoom.hostId;
  const maxParticipants = 10;
  const emptySlots = Array.from({ length: Math.max(0, maxParticipants - participants.length) }, (_, index) => index);
  const title =
    activeRoom.status === "playing"
      ? "릴레이 게임룸"
      : activeRoom.status === "results"
        ? "게임 종료 후 대기화면"
        : "릴레이 대기방";

  return (
    <section className="panel room-panel">
      <div className="panel-header">
        <span className="eyebrow">Room</span>
        <h2>{title}</h2>
      </div>
      <div className="room-meta">
        <div>
          <strong>초대 코드</strong>
          <div className="invite-row">
            <p>{activeRoom.inviteCode}</p>
            <button className="secondary-button invite-copy-button" onClick={onCopyInviteLink}>
              링크 복사
            </button>
          </div>
        </div>
      </div>
      <div className="participants">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className={`participant-card ${participant.id === currentUser?.id ? "participant-card-self" : ""}`}
          >
            <span
              className="participant-avatar"
              style={{ background: `linear-gradient(135deg, hsl(${participant.avatarHue} 80% 90%), white)` }}
            >
              {participant.displayName.slice(0, 1)}
            </span>
            <div>
              <strong>
                {participant.displayName}
                {participant.id === currentUser?.id ? <span className="participant-self-badge">나</span> : null}
              </strong>
              <p>{participant.isAi ? "AI 플레이어" : "실시간 참가자"}</p>
            </div>
          </div>
        ))}
        {activeRoom.status !== "playing"
          ? emptySlots.map((slot) => (
              <div key={`empty-${slot}`} className="participant-card participant-card-empty">
                <span className="participant-avatar participant-avatar-empty">?</span>
                <div>
                  <strong>빈 자리</strong>
                  <p>{isHost && activeRoom.status === "lobby" ? "AI 참가자를 넣을 수 있어요" : "친구 입장 대기 중"}</p>
                </div>
                {isHost && activeRoom.status === "lobby" ? (
                  <button className="secondary-button ai-slot-button" onClick={onAddAiParticipant}>
                    AI 참가
                  </button>
                ) : null}
              </div>
            ))
          : null}
      </div>
      {isHost ? (
        <div className="room-controls">
          {activeRoom.status === "lobby" ? (
            <>
              <div className="single-round-note">
                <strong>게임 방식</strong>
                <p>각자 다른 제시어를 받고, 한 바퀴 돌아 내 제시어가 다시 돌아오면 끝나요.</p>
              </div>
              <div className="difficulty-panel">
                <strong>제시어 난이도</strong>
                <div className="difficulty-actions">
                  {(["easy", "medium", "hard"] as PromptDifficulty[]).map((difficulty) => (
                    <button
                      key={difficulty}
                      className={`secondary-button difficulty-button ${activeRoom.settings.promptDifficulty === difficulty ? "difficulty-button-active" : ""}`}
                      onClick={() => onUpdatePromptDifficulty(difficulty)}
                    >
                      {difficulty === "easy" ? "쉬움" : difficulty === "medium" ? "중간" : "어려움"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="host-actions">
                <button
                  className="primary-button"
                  onClick={onStartGame}
                  disabled={activeRoom.status !== "lobby" || participants.length < 3}
                >
                  {participants.length < 3 ? `3명 모이면 시작` : "게임 시작"}
                </button>
              </div>
            </>
          ) : null}
          {activeRoom.status === "results" ? (
            <div className="host-actions">
              <button className="secondary-button" onClick={onStartGame}>
                한 번 더하기
              </button>
              <button className="primary-button" onClick={onReplayRoom}>
                나가기
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <button className="ghost-button" onClick={onLeaveRoom}>
        나가기
      </button>
    </section>
  );
}
