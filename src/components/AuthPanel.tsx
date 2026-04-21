import type { UserProfile } from "../types";

interface AuthPanelProps {
  currentUser: UserProfile | null;
  joinCode: string;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onJoinCodeChange: (value: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function AuthPanel({
  currentUser,
  joinCode,
  onCreateRoom,
  onJoinRoom,
  onJoinCodeChange,
  onSignIn,
  onSignOut,
}: AuthPanelProps) {
  return (
    <section className="panel auth-panel">
      <div className="panel-header">
        <span className="eyebrow">Quick Start</span>
        <h2>친구들이랑 바로 시작해요</h2>
      </div>
      {currentUser ? (
        <div className="auth-user">
          <img src={currentUser.photoUrl} alt={currentUser.displayName} className="avatar" />
          <div>
            <strong>{currentUser.displayName}</strong>
            <p>{currentUser.monthlyCredits} 크레딧 남음 · 월 10회 갱신</p>
          </div>
          <button className="secondary-button" onClick={onSignOut}>
            로그아웃
          </button>
        </div>
      ) : (
        <button className="primary-button auth-button" onClick={onSignIn}>
          Google 로그인으로 시작하기
        </button>
      )}
      <div className="action-grid">
        <button className="primary-button" onClick={onCreateRoom} disabled={!currentUser}>
          방 만들기
        </button>
        <div className="join-form">
          <input
            value={joinCode}
            onChange={(event) => onJoinCodeChange(event.target.value)}
            placeholder="초대코드 입력"
            maxLength={6}
          />
          <button className="secondary-button" onClick={onJoinRoom} disabled={!currentUser}>
            입장
          </button>
        </div>
      </div>
    </section>
  );
}
