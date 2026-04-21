import { ChatPanel } from "./components/ChatPanel";
import { HomeGate } from "./components/HomeGate";
import { LandingHero } from "./components/LandingHero";
import { ModeSelector } from "./components/ModeSelector";
import { PortalPanel } from "./components/PortalPanel";
import { RelayBoard } from "./components/RelayBoard";
import { RoomPanel } from "./components/RoomPanel";
import { useMugurigeApp } from "./hooks/useMugurigeApp";
import { useEffect, useState } from "react";

export default function App() {
  const app = useMugurigeApp();
  const [hasEnteredPortal, setHasEnteredPortal] = useState(false);
  const [portalMode, setPortalMode] = useState<"menu" | "create" | "join">("menu");

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

  const pageView = !app.isSignedIn || !hasEnteredPortal ? "home" : app.activeRoom ? app.activeRoom.status : "portal";

  return (
    <div className="app-shell">
      <div className="background-doodles background-doodles-left" />
      <div className="background-doodles background-doodles-right" />
      <main className={`page ${pageView === "home" ? "page-home" : ""}`}>
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
          <>
            <div className="portal-top">
              <PortalPanel
                currentUser={app.currentUser}
                joinCode={app.joinCode}
                portalMode={portalMode}
                onJoinCodeChange={app.setJoinCode}
                onJoinRoom={app.joinRoom}
                onSelectCreate={() => setPortalMode("create")}
                onSelectJoin={() => setPortalMode("join")}
              />
            </div>
            {portalMode === "create" ? <ModeSelector onSelectMode={() => void app.createRoom()} /> : null}
          </>
        ) : null}

        {app.activeRoom && pageView === "lobby" ? (
          <>
            <div className="page-heading">
              <span className="eyebrow">Waiting Room</span>
              <h1>대기방</h1>
            </div>
            <div className="play-grid">
              <RoomPanel
                activeRoom={app.activeRoom}
                currentUser={app.currentUser}
                onAddAiParticipant={app.addAiParticipant}
                onCopyInviteLink={app.copyInviteLink}
                onLeaveRoom={app.leaveRoom}
                onReplayRoom={app.restartRoom}
                onEndRoom={app.endRoom}
                onStartGame={app.startGame}
                onUpdateRoundLimit={app.updateRoundLimit}
                participants={app.participants}
                state={app.state}
              />
              <ChatPanel
                composer={app.composer}
                messages={app.messages}
                onChangeComposer={app.setComposer}
                onSend={app.sendChatMessage}
              />
            </div>
          </>
        ) : null}

        {app.activeRoom && pageView === "playing" ? (
          <>
            <div className="page-heading">
              <span className="eyebrow">Game Room</span>
              <h1>게임 플레이 방</h1>
            </div>
            <div className="play-grid">
              <RelayBoard
                activeRoom={app.activeRoom}
                assignments={app.assignments}
                entries={app.entries}
                session={app.session}
                state={app.state}
                submitTextAssignment={app.submitTextAssignment}
              />
              <ChatPanel
                composer={app.composer}
                messages={app.messages}
                onChangeComposer={app.setComposer}
                onSend={app.sendChatMessage}
              />
            </div>
          </>
        ) : null}

        {app.activeRoom && pageView === "results" ? (
          <>
            <div className="page-heading">
              <span className="eyebrow">After Game</span>
              <h1>게임 종료 후 대기화면</h1>
            </div>
            <div className="play-grid postgame-grid">
              <RoomPanel
                activeRoom={app.activeRoom}
                currentUser={app.currentUser}
                onAddAiParticipant={app.addAiParticipant}
                onCopyInviteLink={app.copyInviteLink}
                onLeaveRoom={app.leaveRoom}
                onReplayRoom={app.restartRoom}
                onEndRoom={app.endRoom}
                onStartGame={app.startGame}
                onUpdateRoundLimit={app.updateRoundLimit}
                participants={app.participants}
                state={app.state}
              />
              <ChatPanel
                composer={app.composer}
                messages={app.messages}
                onChangeComposer={app.setComposer}
                onSend={app.sendChatMessage}
              />
            </div>
            <div className="results-row">
              <RelayBoard
                activeRoom={app.activeRoom}
                assignments={app.assignments}
                entries={app.entries}
                session={app.session}
                state={app.state}
                submitTextAssignment={app.submitTextAssignment}
              />
            </div>
          </>
        ) : null}
      </main>
      {app.toast ? <div className="toast">{app.toast}</div> : null}
    </div>
  );
}
