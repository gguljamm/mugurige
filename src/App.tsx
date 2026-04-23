import { ChatPanel } from "./components/ChatPanel";
import { HomeGate } from "./components/HomeGate";
import { LandingHero } from "./components/LandingHero";
import { ModeSelector } from "./components/ModeSelector";
import { PortalPanel } from "./components/PortalPanel";
import { RelayBoard } from "./components/RelayBoard";
import { RoomPanel } from "./components/RoomPanel";
import { useMugurigeApp } from "./hooks/useMugurigeApp";
import { useEffect, useRef, useState } from "react";

export default function App() {
  const app = useMugurigeApp();
  const [hasEnteredPortal, setHasEnteredPortal] = useState(false);
  const [portalMode, setPortalMode] = useState<"menu" | "create" | "join">("menu");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const previousMessageCountRef = useRef(0);
  const previousRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!app.currentUser) {
      setHasEnteredPortal(false);
      setPortalMode("menu");
    }
  }, [app.currentUser]);

  useEffect(() => {
    if (app.activeRoom) {
      setHasEnteredPortal(true);
    }
  }, [app.activeRoom]);

  useEffect(() => {
    const nextRoomId = app.activeRoom?.id ?? null;
    if (previousRoomIdRef.current !== nextRoomId) {
      previousRoomIdRef.current = nextRoomId;
      previousMessageCountRef.current = app.messages.length;
      setUnreadChatCount(0);
      setIsChatOpen(false);
      return;
    }

    if (app.messages.length > previousMessageCountRef.current) {
      const incomingCount = app.messages.length - previousMessageCountRef.current;
      if (isChatOpen) {
        setUnreadChatCount(0);
      } else {
        setUnreadChatCount((count) => count + incomingCount);
      }
    }

    previousMessageCountRef.current = app.messages.length;
  }, [app.activeRoom?.id, app.messages.length, isChatOpen]);

  useEffect(() => {
    if (isChatOpen) {
      setUnreadChatCount(0);
    }
  }, [isChatOpen]);

  const pageView = !app.isSignedIn || !hasEnteredPortal ? "home" : app.activeRoom ? app.activeRoom.status : "portal";

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.style.overflow = pageView === "playing" ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [pageView]);
  const shouldShowFloatingChat = Boolean(app.activeRoom) && pageView !== "home" && pageView !== "portal";

  return (
    <div className={`app-shell ${pageView === "playing" ? "app-shell-playing" : ""}`}>
      <div className="background-doodles background-doodles-left" />
      <div className="background-doodles background-doodles-right" />
      <main className={`page page-${pageView} ${pageView === "home" ? "page-home" : ""}`}>
        {pageView === "home" ? (
          <LandingHero>
              <HomeGate
                isSignedIn={app.isSignedIn}
                onProceed={() => setHasEnteredPortal(true)}
                onSignIn={app.signIn}
                onSignOut={app.signOut}
              />
          </LandingHero>
        ) : null}

        {pageView === "portal" ? (
          <div className="screen-stack">
            <div className="portal-top">
              <PortalPanel
                currentUser={app.currentUser}
                joinCode={app.joinCode}
                nicknameDraft={app.nicknameDraft}
                portalMode={portalMode}
                onJoinCodeChange={app.setJoinCode}
                onJoinRoom={app.joinRoom}
                onNicknameDraftChange={app.setNicknameDraft}
                onSaveNickname={app.saveNickname}
                onSelectCreate={() => setPortalMode("create")}
                onSelectJoin={() => setPortalMode("join")}
              />
            </div>
            {portalMode === "create" ? <ModeSelector onSelectMode={() => void app.createRoom()} /> : null}
          </div>
        ) : null}

        {app.activeRoom && pageView === "lobby" ? (
          <div className="screen-stack">
            <div className="play-grid">
              <RoomPanel
                activeRoom={app.activeRoom}
                currentUser={app.currentUser}
                onAddAiParticipant={app.addAiParticipant}
                onCopyInviteLink={app.copyInviteLink}
                onLeaveRoom={app.leaveRoom}
                onReplayRoom={app.restartRoom}
                onStartGame={app.startGame}
                onUpdatePromptDifficulty={app.updatePromptDifficulty}
                participants={app.participants}
              />
            </div>
          </div>
        ) : null}

        {app.activeRoom && pageView === "playing" ? (
          <div className="play-grid play-grid-playing">
              <RelayBoard
                activeRoom={app.activeRoom}
                assignments={app.assignments}
                currentUserId={app.currentUser?.id}
                isFullscreenPlay
                session={app.session}
                state={app.state}
                submitTextAssignment={app.submitTextAssignment}
              />
          </div>
        ) : null}

        {app.activeRoom && pageView === "results" ? (
          <div className="screen-stack">
            <div className="results-row">
              <RelayBoard
                activeRoom={app.activeRoom}
                assignments={app.assignments}
                currentUserId={app.currentUser?.id}
                session={app.session}
                state={app.state}
                submitTextAssignment={app.submitTextAssignment}
              />
            </div>
            {app.currentUser?.id === app.activeRoom.hostId ? (
              <div className="results-actions">
                <button className="secondary-button" onClick={app.startGame}>
                  한 번 더하기
                </button>
                <button className="primary-button" onClick={app.restartRoom}>
                  나가기
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
      {shouldShowFloatingChat ? (
        <>
          <button className="chat-fab" onClick={() => setIsChatOpen((open) => !open)}>
            채팅
            {unreadChatCount > 0 ? <span className="chat-fab-badge">{unreadChatCount}</span> : null}
          </button>
          {isChatOpen ? (
            <div className="chat-float-wrap">
              <ChatPanel
                composer={app.composer}
                currentUserId={app.currentUser?.id}
                isOpen={isChatOpen}
                messages={app.messages}
                onChangeComposer={app.setComposer}
                onClose={() => setIsChatOpen(false)}
                onSend={app.sendChatMessage}
              />
            </div>
          ) : null}
        </>
      ) : null}
      {app.toast ? <div className="toast">{app.toast}</div> : null}
    </div>
  );
}
