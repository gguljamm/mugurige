import type { UserProfile } from "../types";

interface PortalPanelProps {
  currentUser: UserProfile | null;
  joinCode: string;
  nicknameDraft: string;
  portalMode: "menu" | "create" | "join";
  onJoinCodeChange: (value: string) => void;
  onJoinRoom: () => void;
  onNicknameDraftChange: (value: string) => void;
  onSaveNickname: () => void;
  onSelectCreate: () => void;
  onSelectJoin: () => void;
}

export function PortalPanel({
  currentUser,
  joinCode,
  nicknameDraft,
  portalMode,
  onJoinCodeChange,
  onJoinRoom,
  onNicknameDraftChange,
  onSaveNickname,
  onSelectCreate,
  onSelectJoin,
}: PortalPanelProps) {
  return (
    <section className="panel auth-panel">
      <div className="panel-header">
        <span className="eyebrow">Start Page</span>
        <h2>방 만들기 / 참가하기</h2>
      </div>
      {currentUser ? (
        <div className="nickname-panel">
          <div className="nickname-copy">
            <strong>내 닉네임</strong>
            <p>게임 안에서 보이는 이름이에요.</p>
          </div>
          <div className="nickname-form">
            <input
              value={nicknameDraft}
              onChange={(event) => onNicknameDraftChange(event.target.value)}
              placeholder="닉네임 입력"
              maxLength={18}
            />
            <button className="secondary-button" onClick={onSaveNickname}>
              저장
            </button>
          </div>
        </div>
      ) : null}
      <div className="portal-choice-grid">
        <button className={`portal-card ${portalMode === "create" ? "portal-card-active" : ""}`} onClick={onSelectCreate}>
          <strong>방 만들기</strong>
          <span>게임 모드를 고르고 새 대기방을 엽니다.</span>
        </button>
        <button className={`portal-card ${portalMode === "join" ? "portal-card-active" : ""}`} onClick={onSelectJoin}>
          <strong>참가하기</strong>
          <span>초대 코드로 이미 열린 방에 입장합니다.</span>
        </button>
      </div>
      {portalMode === "join" ? (
        <div className="join-form">
          <input
            value={joinCode}
            onChange={(event) => onJoinCodeChange(event.target.value)}
            placeholder="초대코드 입력"
            maxLength={6}
          />
          <button className="primary-button" onClick={onJoinRoom} disabled={!currentUser}>
            참가하기
          </button>
        </div>
      ) : (
        <p className="portal-help">방 만들기를 누르면 아래에서 현재 제공 중인 게임 모드를 선택할 수 있어요.</p>
      )}
    </section>
  );
}
