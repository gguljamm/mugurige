interface HomeGateProps {
  isSignedIn: boolean;
  onProceed: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function HomeGate({ isSignedIn, onProceed, onSignIn, onSignOut }: HomeGateProps) {
  return (
    <section className="home-gate">
      <div className="home-gate-actions">
        {isSignedIn ? (
          <>
            <button className="primary-button" onClick={onProceed}>
              시작하기
            </button>
            <button className="secondary-button auth-button" onClick={onSignOut}>
              로그아웃
            </button>
          </>
        ) : (
          <button className="primary-button auth-button" onClick={onSignIn}>
            Google 로그인
          </button>
        )}
      </div>
    </section>
  );
}
