import { roomProgressText } from "../lib/game";
import type { Participant, PersistedState, Room, UserProfile } from "../types";

interface RoomPanelProps {
  activeRoom: Room | null;
  currentUser: UserProfile | null;
  participants: Participant[];
  state: PersistedState;
  onAddAiParticipant: () => void;
  onCopyInviteLink?: () => void;
  onLeaveRoom: () => void;
  onReplayRoom?: () => void;
  onEndRoom?: () => void;
  onStartGame: () => void;
  onUpdateRoundLimit: (value: number) => void;
}

export function RoomPanel({
  activeRoom,
  currentUser,
  participants,
  state,
  onAddAiParticipant,
  onCopyInviteLink,
  onLeaveRoom,
  onReplayRoom,
  onEndRoom,
  onStartGame,
  onUpdateRoundLimit,
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
  const maxParticipants = 8;
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
        <div>
          <strong>상태</strong>
          <p>{roomProgressText(state, activeRoom.id)}</p>
        </div>
      </div>
      <div className="participants">
        {participants.map((participant) => (
          <div key={participant.id} className="participant-card">
            <span
              className="participant-avatar"
              style={{ background: `linear-gradient(135deg, hsl(${participant.avatarHue} 80% 90%), white)` }}
            >
              {participant.displayName.slice(0, 1)}
            </span>
            <div>
              <strong>{participant.displayName}</strong>
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
                  <button className="secondary-button" onClick={onAddAiParticipant}>
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
              <label>
                라운드 수
                <input
                  type="range"
                  min={3}
                  max={8}
                  value={activeRoom.settings.roundLimit}
                  onChange={(event) => onUpdateRoundLimit(Number(event.target.value))}
                />
                <span>{activeRoom.settings.roundLimit} 라운드</span>
              </label>
              <div className="host-actions">
                <button className="secondary-button" onClick={onAddAiParticipant}>
                  AI 참가자 추가 (-1 credit)
                </button>
                <button className="primary-button" onClick={onStartGame} disabled={activeRoom.status !== "lobby"}>
                  게임 시작
                </button>
              </div>
            </>
          ) : null}
          {activeRoom.status === "results" ? (
            <div className="host-actions">
              <button className="secondary-button" onClick={onReplayRoom}>
                한 번 더하기
              </button>
              <button className="primary-button" onClick={onEndRoom}>
                종료하기
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
