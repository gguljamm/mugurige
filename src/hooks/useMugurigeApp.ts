import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { getDownloadURL, ref, uploadString } from "firebase/storage";
import {
  ensureMonthlyCredits,
  getAssigneeForRound,
  getAssignmentsForParticipant,
  getCurrentUser,
  getStageDurationSeconds,
  getStageKind,
  getTotalPlayableRounds,
  getRoomParticipants,
  initialState,
  makeAiDrawing,
  makeAiGuess,
  pickPromptBatch,
  makeChatMessage,
  makeEntry,
  makeParticipant,
  makeRoom,
  makeUser,
  pickAiName,
  sortParticipants,
} from "../lib/game";
import { firebaseAuth, firebaseConfigured, firebaseDb, firebaseFunctions, firebaseStorage, googleProvider } from "../lib/firebase";
import type { Assignment, PersistedState, PromptDifficulty } from "../types";

const STORAGE_KEY = "mugurige-mvp-state";
const STAGE_FORCE_ADVANCE_GRACE_MS = 2000;

function readState(): PersistedState {
  if (typeof window === "undefined") {
    return initialState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return initialState;
    }

    return JSON.parse(raw) as PersistedState;
  } catch {
    return initialState;
  }
}

function writeState(state: PersistedState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function readActiveRoomId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(`${STORAGE_KEY}:activeRoom`);
}

function writeActiveRoomId(roomId: string | null) {
  if (roomId) {
    window.localStorage.setItem(`${STORAGE_KEY}:activeRoom`, roomId);
  } else {
    window.localStorage.removeItem(`${STORAGE_KEY}:activeRoom`);
  }
}

function readInviteCodeFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const inviteCode = new URLSearchParams(window.location.search).get("invite");
  return inviteCode ? inviteCode.trim().toUpperCase() : null;
}

function writeInviteCodeToUrl(inviteCode: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (inviteCode) {
    url.searchParams.set("invite", inviteCode);
  } else {
    url.searchParams.delete("invite");
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", nextUrl);
}

function isLocalDevelopment() {
  if (typeof window === "undefined") {
    return false;
  }

  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function entryDocId(chainId: string, round: number) {
  return `${chainId}_${round}`;
}

function upsertRoomState<T extends keyof PersistedState>(
  previous: PersistedState,
  key: T,
  roomId: string,
  value: PersistedState[T] extends Record<string, infer V> ? V : never,
): PersistedState {
  const currentRecord = previous[key] as Record<string, unknown>;
  return {
    ...previous,
    [key]: {
      ...currentRecord,
      [roomId]: value,
    },
  };
}

function mergeRoomEntry(
  previousEntries: PersistedState["entriesByRoom"][string] | undefined,
  nextEntry: PersistedState["entriesByRoom"][string][number],
) {
  const merged = [...(previousEntries ?? []).filter((entry) => entry.id !== nextEntry.id), nextEntry];
  return merged.sort((a, b) => a.round - b.round || a.createdAt - b.createdAt);
}

function automateAiAndProgress(source: PersistedState, roomId: string): PersistedState {
  const nextState: PersistedState = structuredClone(source);

  for (let pass = 0; pass < 40; pass += 1) {
    const room = nextState.rooms[roomId];
    const session = nextState.sessionsByRoom[roomId];
    const participants = getRoomParticipants(nextState, roomId);
    const entries = nextState.entriesByRoom[roomId] ?? [];

    if (!room || !session || room.status !== "playing" || participants.length === 0) {
      return nextState;
    }

    let changed = false;

    for (let starterIndex = 0; starterIndex < participants.length; starterIndex += 1) {
      const starter = participants[starterIndex];
      const assignee = getAssigneeForRound(participants, starterIndex, session.currentRound, session.initialOffset);
      const currentEntry = entries.find(
        (entry) => entry.chainId === starter.id && entry.round === session.currentRound,
      );

      if (!assignee || !assignee.isAi || currentEntry) {
        continue;
      }

      const previousEntry = entries.find(
        (entry) => entry.chainId === starter.id && entry.round === session.currentRound - 1,
      );
      const kind = getStageKind(session.currentRound);
      const content =
        kind === "drawing"
          ? makeAiDrawing(previousEntry?.content ?? "상상 그림")
          : makeAiGuess(previousEntry?.content ?? "");

      entries.push(
        makeEntry(roomId, starter.id, session.currentRound, kind, assignee.id, assignee.displayName, content),
      );
      changed = true;
    }

    const roundEntries = entries.filter((entry) => entry.round === session.currentRound).length;
    if (roundEntries === participants.length) {
      if (session.currentRound >= session.totalRounds) {
        nextState.rooms[roomId] = {
          ...room,
          status: "results",
        };
        nextState.sessionsByRoom[roomId] = {
          ...session,
          completedAt: Date.now(),
        };
        changed = true;
      } else {
        const nextRound = session.currentRound + 1;
        nextState.sessionsByRoom[roomId] = {
          ...session,
          currentRound: nextRound,
          stageStartedAt: Date.now(),
          stageDurationSec: getStageDurationSeconds(nextRound),
        };
        changed = true;
      }
    }

    if (!changed) {
      return nextState;
    }
  }

  return nextState;
}

export function useMugurigeApp() {
  const [state, setState] = useState<PersistedState>(() => readState());
  const isFirebaseMode = firebaseConfigured && Boolean(firebaseAuth && firebaseDb);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => readActiveRoomId());
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(() => readInviteCodeFromUrl());
  const [isAutoJoiningInvite, setIsAutoJoiningInvite] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [composer, setComposer] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseMode) {
      writeState(state);
    }
  }, [isFirebaseMode, state]);

  useEffect(() => {
    writeActiveRoomId(activeRoomId);
  }, [activeRoomId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncInviteCode = () => {
      const inviteCode = readInviteCodeFromUrl();
      setPendingInviteCode(inviteCode);
      if (inviteCode) {
        setJoinCode(inviteCode);
      }
    };

    syncInviteCode();
    window.addEventListener("popstate", syncInviteCode);
    return () => window.removeEventListener("popstate", syncInviteCode);
  }, []);

  useEffect(() => {
    if (!isFirebaseMode || !firebaseAuth || !firebaseDb) {
      return undefined;
    }

    const db = firebaseDb;
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (authUser) => {
      if (!authUser) {
        setState((previous) => ({
          ...previous,
          currentUserId: null,
          users: {},
          activeRoomId: null,
        }));
        setActiveRoomId(null);
        return;
      }

      const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      const userRef = doc(db, "users", authUser.uid);
      let existingProfile: PersistedState["users"][string] | null = null;

      try {
        const existingSnapshot = await getDoc(userRef);
        if (existingSnapshot.exists()) {
          existingProfile = existingSnapshot.data() as PersistedState["users"][string];
        }
      } catch (error) {
        console.error("auth:userRead", error);
      }

      const nextDisplayName =
        existingProfile?.displayName
        ?? authUser.displayName
        ?? "머그리게 플레이어";
      const nextAccountName =
        existingProfile?.accountName
        ?? authUser.displayName
        ?? "Google User";
      const nextMonthlyCredits = existingProfile?.monthlyCredits ?? 10;
      const nextCreditResetAt = existingProfile?.creditResetAt ?? monthKey;

      setState((previous) => ({
        ...previous,
        currentUserId: authUser.uid,
        users: {
          ...previous.users,
          [authUser.uid]: {
            id: authUser.uid,
            displayName: nextDisplayName,
            accountName: nextAccountName,
            photoUrl: authUser.photoURL ?? "",
            monthlyCredits: nextMonthlyCredits,
            creditResetAt: nextCreditResetAt,
            provider: "google",
          },
        },
      }));

      try {
        await setDoc(
          userRef,
          {
            id: authUser.uid,
            displayName: nextDisplayName,
            accountName: nextAccountName,
            photoUrl: authUser.photoURL ?? "",
            monthlyCredits: nextMonthlyCredits,
            creditResetAt: nextCreditResetAt,
            provider: "google",
          },
          { merge: true },
        );

        if (firebaseFunctions && !isLocalDevelopment()) {
          try {
            const syncCredits = httpsCallable(firebaseFunctions, "syncMonthlyCredits");
            await syncCredits();
          } catch {
            // Keep local sign-in flowing even if functions are not deployed yet.
          }
        }
      } catch (error) {
        console.error("auth:userSync", error);
      }

      setState((previous) => ({
        ...previous,
        currentUserId: authUser.uid,
      }));
    });

    return unsubscribe;
  }, [isFirebaseMode]);

  useEffect(() => {
    if (!isFirebaseMode || !firebaseDb || !state.currentUserId) {
      return undefined;
    }

    const currentUserId = state.currentUserId;

    return onSnapshot(doc(firebaseDb, "users", currentUserId), (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }

      const profile = {
        ...(snapshot.data() as PersistedState["users"][string]),
        id: currentUserId,
      };
      setState((previous) => ({
        ...previous,
        users: {
          ...previous.users,
          [currentUserId]: profile,
        },
      }));
    }, (error) => {
      console.error("users:onSnapshot", error);
    });
  }, [isFirebaseMode, state.currentUserId]);

  useEffect(() => {
    if (!isFirebaseMode || !firebaseDb || !activeRoomId) {
      setState((previous) => ({
        ...previous,
        activeRoomId: activeRoomId ?? null,
      }));
      return undefined;
    }

    const db = firebaseDb;
    const roomRef = doc(db, "rooms", activeRoomId);
    const participantQuery = query(
      collection(db, "rooms", activeRoomId, "roomParticipants"),
      orderBy("turnOrder", "asc"),
    );
    const chatQuery = query(collection(db, "rooms", activeRoomId, "chatMessages"), orderBy("createdAt", "asc"));
    const entryQuery = query(collection(db, "rooms", activeRoomId, "entries"), orderBy("round", "asc"));

    const offRoom = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        setState((previous) => {
          const nextRooms = { ...previous.rooms };
          const nextParticipants = { ...previous.participantsByRoom };
          const nextMessages = { ...previous.messagesByRoom };
          const nextEntries = { ...previous.entriesByRoom };
          const nextSessions = { ...previous.sessionsByRoom };
          delete nextRooms[activeRoomId];
          delete nextParticipants[activeRoomId];
          delete nextMessages[activeRoomId];
          delete nextEntries[activeRoomId];
          delete nextSessions[activeRoomId];
          return {
            ...previous,
            rooms: nextRooms,
            participantsByRoom: nextParticipants,
            messagesByRoom: nextMessages,
            entriesByRoom: nextEntries,
            sessionsByRoom: nextSessions,
            activeRoomId: null,
          };
        });
        setActiveRoomId(null);
        setPendingInviteCode(null);
        return;
      }

      const room = snapshot.data() as PersistedState["rooms"][string];
      setState((previous) => ({
        ...upsertRoomState(previous, "rooms", activeRoomId, room),
        activeRoomId,
      }));
    });

    const offParticipants = onSnapshot(participantQuery, (snapshot) => {
      const participants = sortParticipants(
        snapshot.docs.map((item) => item.data() as PersistedState["participantsByRoom"][string][number]),
      );
      setState((previous) => ({
        ...upsertRoomState(previous, "participantsByRoom", activeRoomId, participants),
        activeRoomId,
      }));
    });

    const offMessages = onSnapshot(chatQuery, (snapshot) => {
      const messages = snapshot.docs.map((item) => item.data() as PersistedState["messagesByRoom"][string][number]);
      setState((previous) => ({
        ...upsertRoomState(previous, "messagesByRoom", activeRoomId, messages),
        activeRoomId,
      }));
    });

    const offEntries = onSnapshot(entryQuery, (snapshot) => {
      const roomEntries = snapshot.docs.map((item) => item.data() as PersistedState["entriesByRoom"][string][number]);
      setState((previous) => ({
        ...upsertRoomState(previous, "entriesByRoom", activeRoomId, roomEntries),
        activeRoomId,
      }));
    });

    const offSession = onSnapshot(
      doc(db, "rooms", activeRoomId, "gameSessions", "current"),
      async (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }

        const roomSession = snapshot.data() as PersistedState["sessionsByRoom"][string];

        try {
          const entrySnapshot = await getDocs(
            query(collection(db, "rooms", activeRoomId, "entries"), orderBy("round", "asc")),
          );
          const roomEntries = entrySnapshot.docs.map(
            (item) => item.data() as PersistedState["entriesByRoom"][string][number],
          );

          setState((previous) => ({
            ...upsertRoomState(
              upsertRoomState(previous, "entriesByRoom", activeRoomId, roomEntries),
              "sessionsByRoom",
              activeRoomId,
              roomSession,
            ),
            activeRoomId,
          }));
          return;
        } catch (error) {
          console.error("session:entriesRefresh", error);
        }

        setState((previous) => ({
          ...upsertRoomState(previous, "sessionsByRoom", activeRoomId, roomSession),
          activeRoomId,
        }));
      },
    );

    return () => {
      offRoom();
      offParticipants();
      offMessages();
      offEntries();
      offSession();
    };
  }, [activeRoomId, isFirebaseMode]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const currentUser = getCurrentUser(state);
  const currentActorId = firebaseAuth?.currentUser?.uid ?? state.currentUserId ?? currentUser?.id ?? null;
  const effectiveActiveRoomId = isFirebaseMode ? activeRoomId : state.activeRoomId;
  const activeRoom = effectiveActiveRoomId ? state.rooms[effectiveActiveRoomId] ?? null : null;
  const participants = activeRoom ? getRoomParticipants(state, activeRoom.id) : [];
  const session = activeRoom ? state.sessionsByRoom[activeRoom.id] ?? null : null;
  const entries = activeRoom ? state.entriesByRoom[activeRoom.id] ?? [] : [];
  const messages = activeRoom ? state.messagesByRoom[activeRoom.id] ?? [] : [];
  const currentParticipant =
    currentActorId && activeRoom
      ? participants.find((participant) => participant.id === currentActorId && !participant.isAi) ?? null
      : null;
  const assignments: Assignment[] = useMemo(
    () => (activeRoom && currentParticipant ? getAssignmentsForParticipant(state, activeRoom.id, currentParticipant.id) : []),
    [activeRoom, currentParticipant, state],
  );

  useEffect(() => {
    setNicknameDraft(currentUser?.displayName ?? "");
  }, [currentUser?.displayName]);

  useEffect(() => {
    if (!activeRoom || !session || activeRoom.status !== "playing") {
      return undefined;
    }

    const tick = window.setInterval(() => {
      const expiresAt = session.stageStartedAt + session.stageDurationSec * 1000;
      if (Date.now() < expiresAt + STAGE_FORCE_ADVANCE_GRACE_MS) {
        return;
      }

      if (isFirebaseMode) {
        if (currentUser?.id === activeRoom.hostId) {
          void forceAdvanceFirebaseStage(activeRoom.id);
        }
        return;
      }

      forceAdvanceLocalStage(activeRoom.id);
    }, 500);

    return () => window.clearInterval(tick);
  }, [activeRoom, currentUser?.id, isFirebaseMode, session]);

  useEffect(() => {
    if (activeRoom?.inviteCode) {
      writeInviteCodeToUrl(activeRoom.inviteCode);
      return;
    }

    if (pendingInviteCode) {
      writeInviteCodeToUrl(pendingInviteCode);
      return;
    }

    writeInviteCodeToUrl(null);
  }, [activeRoom?.inviteCode, pendingInviteCode]);

  async function joinRoomByCode(code: string) {
    const authUser = firebaseAuth?.currentUser ?? null;
    if (isFirebaseMode && authUser) {
      await authUser.getIdToken();
    }

    const actorId = authUser?.uid ?? currentUser?.id ?? state.currentUserId;
    const actorDisplayName =
      currentUser?.displayName
      ?? authUser?.displayName
      ?? state.users[state.currentUserId ?? ""]?.displayName
      ?? "머그리게 플레이어";

    if (!actorId) {
      setToast("먼저 로그인해 주세요");
      return false;
    }

    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setToast("초대 코드를 입력해 주세요");
      return false;
    }

    if (isFirebaseMode && firebaseDb) {
      const roomSnapshot = await getDocs(
        query(collection(firebaseDb, "rooms"), where("inviteCode", "==", normalizedCode), limit(1)),
      );
      if (roomSnapshot.empty) {
        setToast("해당 코드의 방을 찾지 못했어요");
        return false;
      }

      const room = roomSnapshot.docs[0].data() as PersistedState["rooms"][string];
      const participantRef = doc(firebaseDb, "rooms", room.id, "roomParticipants", actorId);
      const nextParticipant = makeParticipant(room.id, actorDisplayName, false, Date.now() + Math.random(), actorId);

      try {
        await setDoc(participantRef, nextParticipant, { merge: true });
      } catch (error) {
        console.error("joinRoom:participant", error);
        throw error;
      }

      setState((previous) => ({
        ...previous,
        activeRoomId: room.id,
        participantsByRoom: {
          ...previous.participantsByRoom,
          [room.id]: previous.participantsByRoom[room.id]?.some((participant) => participant.id === actorId)
            ? previous.participantsByRoom[room.id]
            : [...(previous.participantsByRoom[room.id] ?? []), nextParticipant],
        },
      }));
      setActiveRoomId(room.id);
      setJoinCode("");
      setPendingInviteCode(normalizedCode);

      try {
        await setDoc(
          doc(collection(firebaseDb, "rooms", room.id, "chatMessages")),
          makeChatMessage(room.id, actorId, actorDisplayName, `${actorDisplayName} 님이 입장했어요.`),
        );
      } catch (error) {
        console.error("joinRoom:chat", error);
      }

      return true;
    }

    patchState((draft) => {
      const room = Object.values(draft.rooms).find((item) => item.inviteCode === normalizedCode);
      if (!room) {
        setToast("해당 코드의 방을 찾지 못했어요");
        return draft;
      }

      const existing = draft.participantsByRoom[room.id]?.find(
        (participant) => participant.id === actorId && !participant.isAi,
      );
      if (!existing) {
        const nextOrder = draft.participantsByRoom[room.id]?.length ?? 0;
        draft.participantsByRoom[room.id] = [
          ...(draft.participantsByRoom[room.id] ?? []),
          makeParticipant(room.id, actorDisplayName, false, nextOrder, actorId),
        ];
        draft.messagesByRoom[room.id] = [
          ...(draft.messagesByRoom[room.id] ?? []),
          makeChatMessage(room.id, "system", "Mugurige", `${actorDisplayName} 님이 입장했어요.`),
        ];
      }

      draft.activeRoomId = room.id;
    });
    setJoinCode("");
    setPendingInviteCode(normalizedCode);
    return true;
  }

  useEffect(() => {
    if (!pendingInviteCode || !state.currentUserId || activeRoomId || isAutoJoiningInvite) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsAutoJoiningInvite(true);
      try {
        const joined = await joinRoomByCode(pendingInviteCode);
        if (!cancelled && joined) {
          setToast("초대 링크로 방에 참가했어요");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("autoJoinInvite", error);
          setToast("초대 링크 참가 중 문제가 생겼어요");
        }
      } finally {
        if (!cancelled) {
          setIsAutoJoiningInvite(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeRoomId, isAutoJoiningInvite, pendingInviteCode, state.currentUserId]);

  async function processFirebaseRoom(roomId: string) {
    if (!firebaseDb) {
      return;
    }

    const db = firebaseDb;
    const roomRef = doc(db, "rooms", roomId);
    const sessionRef = doc(db, "rooms", roomId, "gameSessions", "current");

    for (let pass = 0; pass < 40; pass += 1) {
      const [roomSnapshot, sessionSnapshot, participantSnapshot, entrySnapshot] = await Promise.all([
        getDoc(roomRef),
        getDoc(sessionRef),
        getDocs(query(collection(db, "rooms", roomId, "roomParticipants"), orderBy("turnOrder", "asc"))),
        getDocs(query(collection(db, "rooms", roomId, "entries"), orderBy("round", "asc"))),
      ]);

      if (!roomSnapshot.exists() || !sessionSnapshot.exists()) {
        return;
      }

      const room = roomSnapshot.data() as PersistedState["rooms"][string];
      const roomSession = sessionSnapshot.data() as PersistedState["sessionsByRoom"][string];
      const roomParticipants = sortParticipants(
        participantSnapshot.docs.map((item) => item.data() as PersistedState["participantsByRoom"][string][number]),
      );
      const roomEntries = entrySnapshot.docs.map((item) => item.data() as PersistedState["entriesByRoom"][string][number]);

      if (room.status !== "playing" || roomParticipants.length === 0) {
        return;
      }

      let changed = false;
      const batch = writeBatch(db);

      for (let starterIndex = 0; starterIndex < roomParticipants.length; starterIndex += 1) {
        const starter = roomParticipants[starterIndex];
        const assignee = getAssigneeForRound(
          roomParticipants,
          starterIndex,
          roomSession.currentRound,
          roomSession.initialOffset,
        );
        const currentEntry = roomEntries.find(
          (entry) => entry.chainId === starter.id && entry.round === roomSession.currentRound,
        );

        if (!assignee || !assignee.isAi || currentEntry) {
          continue;
        }

        const previousEntry = roomEntries.find(
          (entry) => entry.chainId === starter.id && entry.round === roomSession.currentRound - 1,
        );
        const kind = getStageKind(roomSession.currentRound);
        const content =
          kind === "drawing"
            ? makeAiDrawing(previousEntry?.content ?? "상상 그림")
            : makeAiGuess(previousEntry?.content ?? "");
        const nextEntry = makeEntry(
          roomId,
          starter.id,
          roomSession.currentRound,
          kind,
          assignee.id,
          assignee.displayName,
          content,
          entryDocId(starter.id, roomSession.currentRound),
        );

        batch.set(doc(db, "rooms", roomId, "entries", nextEntry.id), nextEntry);
        roomEntries.push(nextEntry);
        changed = true;
      }

      const roundEntries = roomEntries.filter((entry) => entry.round === roomSession.currentRound).length;
      if (roundEntries === roomParticipants.length) {
        if (roomSession.currentRound >= roomSession.totalRounds) {
          batch.update(roomRef, { status: "results" });
          batch.update(sessionRef, { completedAt: Date.now() });
          changed = true;
        } else {
          const nextRound = roomSession.currentRound + 1;
          batch.update(sessionRef, {
            currentRound: nextRound,
            stageStartedAt: Date.now(),
            stageDurationSec: getStageDurationSeconds(nextRound),
          });
          changed = true;
        }
      }

      if (!changed) {
        return;
      }

      await batch.commit();
      await syncFirebaseRoomState(roomId);
    }
  }

  async function syncFirebaseRoomState(roomId: string) {
    if (!firebaseDb) {
      return;
    }

    const db = firebaseDb;
    const [roomSnapshot, sessionSnapshot, entrySnapshot] = await Promise.all([
      getDoc(doc(db, "rooms", roomId)),
      getDoc(doc(db, "rooms", roomId, "gameSessions", "current")).catch(() => null),
      getDocs(query(collection(db, "rooms", roomId, "entries"), orderBy("round", "asc"))),
    ]);

    const room = roomSnapshot.exists() ? (roomSnapshot.data() as PersistedState["rooms"][string]) : null;
    const roomSession =
      sessionSnapshot && "exists" in sessionSnapshot && sessionSnapshot.exists()
        ? (sessionSnapshot.data() as PersistedState["sessionsByRoom"][string])
        : null;
    const roomEntries = entrySnapshot.docs.map(
      (item) => item.data() as PersistedState["entriesByRoom"][string][number],
    );

    setState((previous) => {
      let nextState = upsertRoomState(previous, "entriesByRoom", roomId, roomEntries);

      if (room) {
        nextState = upsertRoomState(nextState, "rooms", roomId, room);
      }

      if (roomSession) {
        nextState = upsertRoomState(nextState, "sessionsByRoom", roomId, roomSession);
      }

      return {
        ...nextState,
        activeRoomId: roomId,
      };
    });
  }

  async function forceAdvanceFirebaseStage(roomId: string) {
    if (!firebaseDb) {
      return;
    }

    const db = firebaseDb;
    const roomRef = doc(db, "rooms", roomId);
    const sessionRef = doc(db, "rooms", roomId, "gameSessions", "current");
    const [roomSnapshot, sessionSnapshot, participantSnapshot, entrySnapshot] = await Promise.all([
      getDoc(roomRef),
      getDoc(sessionRef),
      getDocs(query(collection(db, "rooms", roomId, "roomParticipants"), orderBy("turnOrder", "asc"))),
      getDocs(query(collection(db, "rooms", roomId, "entries"), orderBy("round", "asc"))),
    ]);

    if (!roomSnapshot.exists() || !sessionSnapshot.exists()) {
      return;
    }

    const room = roomSnapshot.data() as PersistedState["rooms"][string];
    const roomSession = sessionSnapshot.data() as PersistedState["sessionsByRoom"][string];
    const roomParticipants = sortParticipants(
      participantSnapshot.docs.map((item) => item.data() as PersistedState["participantsByRoom"][string][number]),
    );
    const roomEntries = entrySnapshot.docs.map((item) => item.data() as PersistedState["entriesByRoom"][string][number]);

    if (room.status !== "playing") {
      return;
    }

    if (roomSession.currentRound === 0) {
      const nextRound = 1;
      const batch = writeBatch(db);
      batch.update(sessionRef, {
        currentRound: nextRound,
        stageStartedAt: Date.now(),
        stageDurationSec: getStageDurationSeconds(nextRound),
      });
      await batch.commit();
      await syncFirebaseRoomState(roomId);
      await processFirebaseRoom(roomId);
      return;
    }
    const roundEntries = roomEntries.filter((entry) => entry.round === roomSession.currentRound).length;
    if (roundEntries < roomParticipants.length) {
      return;
    }

    const batch = writeBatch(db);
    if (roomSession.currentRound >= roomSession.totalRounds) {
      batch.update(roomRef, { status: "results" });
      batch.update(sessionRef, { completedAt: Date.now() });
      await batch.commit();
      await syncFirebaseRoomState(roomId);
      return;
    }

    const nextRound = roomSession.currentRound + 1;
    batch.update(sessionRef, {
      currentRound: nextRound,
      stageStartedAt: Date.now(),
      stageDurationSec: getStageDurationSeconds(nextRound),
    });
    await batch.commit();
    await syncFirebaseRoomState(roomId);
    await processFirebaseRoom(roomId);
  }

  function patchState(recipe: (draft: PersistedState) => PersistedState | void) {
    setState((previous) => {
      const draft = structuredClone(previous);
      const result = recipe(draft);
      return result ?? draft;
    });
  }

  function forceAdvanceLocalStage(roomId: string) {
    patchState((draft) => {
      const room = draft.rooms[roomId];
      const roomSession = draft.sessionsByRoom[roomId];
      const roomParticipants = getRoomParticipants(draft, roomId);
      const roomEntries = draft.entriesByRoom[roomId] ?? [];

      if (!room || !roomSession || room.status !== "playing") {
        return draft;
      }

      if (roomSession.currentRound === 0) {
        const nextRound = 1;
        draft.sessionsByRoom[roomId] = {
          ...roomSession,
          currentRound: nextRound,
          stageStartedAt: Date.now(),
          stageDurationSec: getStageDurationSeconds(nextRound),
        };
        return automateAiAndProgress(draft, roomId);
      }
      const roundEntries = roomEntries.filter((entry) => entry.round === roomSession.currentRound).length;
      if (roundEntries < roomParticipants.length) {
        return draft;
      }

      if (roomSession.currentRound >= roomSession.totalRounds) {
        draft.rooms[roomId].status = "results";
        draft.sessionsByRoom[roomId] = {
          ...roomSession,
          completedAt: Date.now(),
        };
        return draft;
      }

      const nextRound = roomSession.currentRound + 1;
      draft.sessionsByRoom[roomId] = {
        ...roomSession,
        currentRound: nextRound,
        stageStartedAt: Date.now(),
        stageDurationSec: getStageDurationSeconds(nextRound),
      };
      return automateAiAndProgress(draft, roomId);
    });
  }

  async function signIn() {
    if (isFirebaseMode && firebaseAuth) {
      try {
        await signInWithPopup(firebaseAuth, googleProvider);
        setToast("Google 계정으로 로그인했어요");
      } catch {
        setToast("Google 로그인에 실패했어요");
      }
      return;
    }

    patchState((draft) => {
      const user = makeUser();
      draft.users[user.id] = user;
      draft.currentUserId = user.id;
    });
    setToast(firebaseConfigured ? "Firebase 연결 준비 완료" : "로컬 프리뷰 계정으로 입장했어요");
  }

  async function signOut() {
    if (isFirebaseMode && firebaseAuth) {
      await firebaseSignOut(firebaseAuth);
      setToast("로그아웃했어요");
      return;
    }

    patchState((draft) => {
      draft.currentUserId = null;
      draft.activeRoomId = null;
    });
  }

  async function saveNickname() {
    const nextName = nicknameDraft.trim();
    if (!currentUser || !nextName) {
      setToast("닉네임을 입력해 주세요");
      return;
    }

    if (nextName === currentUser.displayName) {
      setToast("이미 적용된 닉네임이에요");
      return;
    }

    if (isFirebaseMode && firebaseDb) {
      try {
        await setDoc(
          doc(firebaseDb, "users", currentUser.id),
          {
            displayName: nextName,
          },
          { merge: true },
        );

        if (activeRoom) {
          await setDoc(
            doc(firebaseDb, "rooms", activeRoom.id, "roomParticipants", currentUser.id),
            {
              displayName: nextName,
            },
            { merge: true },
          ).catch(() => undefined);
        }

        setToast("닉네임을 저장했어요");
      } catch (error) {
        console.error("saveNickname", error);
        setToast("닉네임 저장 중 문제가 생겼어요");
      }
      return;
    }

    patchState((draft) => {
      draft.users[currentUser.id] = {
        ...draft.users[currentUser.id],
        displayName: nextName,
      };

      if (activeRoom) {
        draft.participantsByRoom[activeRoom.id] = (draft.participantsByRoom[activeRoom.id] ?? []).map((participant) =>
          participant.id === currentUser.id ? { ...participant, displayName: nextName } : participant,
        );
      }
    });
    setToast("닉네임을 저장했어요");
  }

  async function createRoom() {
    const authUser = firebaseAuth?.currentUser ?? null;
    if (isFirebaseMode && authUser) {
      await authUser.getIdToken();
    }

    const actorId = authUser?.uid ?? state.currentUserId ?? currentUser?.id;
    const actorDisplayName =
      currentUser?.displayName
      ?? authUser?.displayName
      ?? state.users[state.currentUserId ?? ""]?.displayName
      ?? "머그리게 플레이어";

    if (!actorId) {
      setToast("먼저 로그인해 주세요");
      return;
    }

    try {
      if (isFirebaseMode && firebaseDb) {
        const roomRef = doc(collection(firebaseDb, "rooms"));
        const room = makeRoom(actorId, "relay");
        room.id = roomRef.id;
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        room.inviteCode = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");

        const hostParticipant = makeParticipant(room.id, actorDisplayName, false, 0, actorId);
        const welcomeMessage = makeChatMessage(
          room.id,
          actorId,
          "Mugurige",
          "릴레이 모드 방이 열렸어요. 친구들을 초대해 보세요!",
        );
        try {
          await setDoc(roomRef, room);
        } catch (error) {
          console.error("createRoom:room", error);
          setToast("방 문서를 만들 권한이 없어요");
          return;
        }

        try {
          await setDoc(doc(firebaseDb, "rooms", room.id, "roomParticipants", hostParticipant.id), hostParticipant);
        } catch (error) {
          console.error("createRoom:participant", error);
          setToast("호스트 참가자 문서를 만들 권한이 없어요");
          return;
        }

        try {
          await setDoc(doc(collection(firebaseDb, "rooms", room.id, "chatMessages")), welcomeMessage);
        } catch (error) {
          console.error("createRoom:chat", error);
          setToast("환영 메시지를 만들 권한이 없어요");
          return;
        }

        setState((previous) => ({
          ...previous,
          rooms: {
            ...previous.rooms,
            [room.id]: room,
          },
          participantsByRoom: {
            ...previous.participantsByRoom,
            [room.id]: [hostParticipant],
          },
          messagesByRoom: {
            ...previous.messagesByRoom,
            [room.id]: [welcomeMessage],
          },
          activeRoomId: room.id,
        }));
        setActiveRoomId(room.id);
        setToast("새 방을 만들었어요");
        return;
      }

      patchState((draft) => {
        if (draft.users[actorId]) {
          draft.users[actorId] = ensureMonthlyCredits(draft.users[actorId]);
        }
        const room = makeRoom(actorId, "relay");
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let next = "";
        do {
          next = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
        } while (Object.values(draft.rooms).some((item) => item.inviteCode === next));
        room.inviteCode = next;
        draft.rooms[room.id] = room;
        draft.participantsByRoom[room.id] = [makeParticipant(room.id, actorDisplayName, false, 0, actorId)];
        draft.entriesByRoom[room.id] = [];
        draft.messagesByRoom[room.id] = [
          makeChatMessage(room.id, "system", "Mugurige", "릴레이 모드 방이 열렸어요. 친구들을 초대해 보세요!"),
        ];
        draft.activeRoomId = room.id;
      });
      setToast("새 방을 만들었어요");
    } catch (error) {
      console.error(error);
      setToast("방을 만드는 중 문제가 생겼어요");
    }
  }

  async function joinRoom() {
    const code = joinCode.trim().toUpperCase();
    void joinRoomByCode(code).catch((error) => {
      console.error("joinRoom", error);
      setToast("방 참가 중 문제가 생겼어요");
    });
  }

  async function updatePromptDifficulty(nextDifficulty: PromptDifficulty) {
    if (!activeRoom || !currentUser || activeRoom.hostId !== currentUser.id) {
      return;
    }

    if (isFirebaseMode && firebaseDb) {
      await updateDoc(doc(firebaseDb, "rooms", activeRoom.id), {
        settings: {
          ...activeRoom.settings,
          promptDifficulty: nextDifficulty,
        },
      });
      return;
    }

    patchState((draft) => {
      draft.rooms[activeRoom.id].settings.promptDifficulty = nextDifficulty;
    });
  }

  async function addAiParticipant() {
    if (!activeRoom || !currentUser || activeRoom.hostId !== currentUser.id) {
      setToast("호스트만 AI 참가자를 추가할 수 있어요");
      return;
    }

    if (isFirebaseMode && firebaseDb) {
      if (firebaseFunctions) {
        try {
          const spendCredit = httpsCallable(firebaseFunctions, "spendCreditForAiParticipant");
          await spendCredit({ roomId: activeRoom.id });
        } catch {
          setToast("AI 참가자 기능을 쓰려면 Cloud Functions를 배포해 주세요");
          return;
        }
      }

      const aiParticipant = makeParticipant(activeRoom.id, pickAiName(), true, Date.now() + Math.random());
      await Promise.all([
        setDoc(doc(firebaseDb, "rooms", activeRoom.id, "roomParticipants", aiParticipant.id), aiParticipant),
        setDoc(
          doc(collection(firebaseDb, "rooms", activeRoom.id, "chatMessages")),
          makeChatMessage(activeRoom.id, "system", "Mugurige", `${aiParticipant.displayName} 가 합류했어요. (-1 credit)`),
        ),
      ]);
      setToast("AI 참가자를 추가했어요");
      return;
    }

    patchState((draft) => {
      const user = ensureMonthlyCredits(draft.users[currentUser.id]);
      if (user.monthlyCredits <= 0) {
        setToast("크레딧이 부족해요");
        return draft;
      }

      draft.users[currentUser.id] = {
        ...user,
        monthlyCredits: user.monthlyCredits - 1,
      };
      const nextOrder = draft.participantsByRoom[activeRoom.id]?.length ?? 0;
      const aiParticipant = makeParticipant(activeRoom.id, pickAiName(), true, nextOrder);
      draft.participantsByRoom[activeRoom.id] = [...(draft.participantsByRoom[activeRoom.id] ?? []), aiParticipant];
      draft.messagesByRoom[activeRoom.id] = [
        ...(draft.messagesByRoom[activeRoom.id] ?? []),
        makeChatMessage(activeRoom.id, "system", "Mugurige", `${aiParticipant.displayName} 가 합류했어요. (-1 credit)`),
      ];
    });
    setToast("AI 참가자를 추가했어요");
  }

  async function startGame() {
    if (!activeRoom || !currentUser || activeRoom.hostId !== currentUser.id) {
      return;
    }

    const roomParticipants = participants;
    if (roomParticipants.length < 3) {
      setToast("최소 3명 이상이 필요해요");
      return;
    }

    try {
      const participantCount = roomParticipants.length;
      const initialOffset = participantCount % 2 === 0 ? 0 : 1;
      const totalRounds = getTotalPlayableRounds(participantCount);
      const initialRound = 0;
      const promptBatch = pickPromptBatch(activeRoom.settings.promptDifficulty, participantCount);
      const promptEntries = roomParticipants.map((starter, starterIndex) =>
        makeEntry(
          activeRoom.id,
          starter.id,
          0,
          "prompt",
          starter.id,
          starter.displayName,
          promptBatch[starterIndex],
          entryDocId(starter.id, 0),
        ),
      );

      if (isFirebaseMode && firebaseDb) {
        const db = firebaseDb;
        const existingEntrySnapshot = await getDocs(collection(db, "rooms", activeRoom.id, "entries"));
        const nextSession = {
          roomId: activeRoom.id,
          currentRound: initialRound,
          totalRounds,
          participantCount,
          initialOffset,
          stageStartedAt: Date.now(),
          stageDurationSec: getStageDurationSeconds(initialRound),
          startedAt: Date.now(),
        };
        const startMessage = makeChatMessage(
          activeRoom.id,
          "system",
          "Mugurige",
          "릴레이 게임이 시작됐어요. 각자 받은 단서로 첫 그림을 그려 주세요!",
        );
        const batch = writeBatch(db);
        const startMessageRef = doc(collection(db, "rooms", activeRoom.id, "chatMessages"));

        existingEntrySnapshot.docs.forEach((item) => {
          batch.delete(item.ref);
        });
        batch.update(doc(db, "rooms", activeRoom.id), { status: "playing" });
        batch.set(doc(db, "rooms", activeRoom.id, "gameSessions", "current"), nextSession);
        promptEntries.forEach((entry) => {
          batch.set(doc(db, "rooms", activeRoom.id, "entries", entry.id), entry);
        });
        batch.set(startMessageRef, startMessage);
        await batch.commit();
        setState((previous) => ({
          ...previous,
          rooms: {
            ...previous.rooms,
            [activeRoom.id]: {
              ...activeRoom,
              status: "playing",
            },
          },
          entriesByRoom: {
            ...previous.entriesByRoom,
            [activeRoom.id]: promptEntries,
          },
          sessionsByRoom: {
            ...previous.sessionsByRoom,
            [activeRoom.id]: nextSession,
          },
          messagesByRoom: {
            ...previous.messagesByRoom,
            [activeRoom.id]: [...(previous.messagesByRoom[activeRoom.id] ?? []), startMessage],
          },
        }));

        return;
      }

      patchState((draft) => {
        const room = draft.rooms[activeRoom.id];
        draft.rooms[activeRoom.id] = {
          ...room,
          status: "playing",
        };
        draft.entriesByRoom[activeRoom.id] = promptEntries;
        draft.sessionsByRoom[activeRoom.id] = {
          roomId: activeRoom.id,
          currentRound: initialRound,
          totalRounds,
          participantCount,
          initialOffset,
          stageStartedAt: Date.now(),
          stageDurationSec: getStageDurationSeconds(initialRound),
          startedAt: Date.now(),
        };
        draft.messagesByRoom[activeRoom.id] = [
          ...(draft.messagesByRoom[activeRoom.id] ?? []),
          makeChatMessage(activeRoom.id, "system", "Mugurige", "릴레이 게임이 시작됐어요. 각자 받은 단서로 첫 그림을 그려 주세요!"),
        ];

        return draft;
      });
    } catch (error) {
      console.error("startGame", error);
      setToast("게임 시작 중 문제가 생겼어요");
    }
  }

  async function submitTextAssignment(content: string) {
    if (!activeRoom || !currentParticipant || assignments.length === 0) {
      return;
    }

    const assignment = assignments.find((item) => !item.currentEntry) ?? assignments[0];
    if (!assignment) {
      setToast("현재 제출할 차례가 없어요");
      return;
    }

    try {
      if (isFirebaseMode && firebaseDb) {
        const entry = makeEntry(
          activeRoom.id,
          assignment.chainId,
          assignment.round,
          assignment.kind,
          currentParticipant.id,
          currentParticipant.displayName,
          content,
          entryDocId(assignment.chainId, assignment.round),
        );
        const entryRef = doc(firebaseDb, "rooms", activeRoom.id, "entries", entry.id);
        await setDoc(entryRef, entry);
        setState((previous) => ({
          ...previous,
          entriesByRoom: {
            ...previous.entriesByRoom,
            [activeRoom.id]: mergeRoomEntry(previous.entriesByRoom[activeRoom.id], entry),
          },
        }));
        await processFirebaseRoom(activeRoom.id);

        if (assignment.kind === "drawing" && firebaseStorage) {
          try {
            const storageRef = ref(firebaseStorage, `roomDrawings/${activeRoom.id}/${entry.id}.jpg`);
            await uploadString(storageRef, content, "data_url");
            const downloadUrl = await getDownloadURL(storageRef);
            await updateDoc(entryRef, { content: downloadUrl });
            setState((previous) => ({
              ...previous,
              entriesByRoom: {
                ...previous.entriesByRoom,
                [activeRoom.id]: mergeRoomEntry(previous.entriesByRoom[activeRoom.id], {
                  ...entry,
                  content: downloadUrl,
                }),
              },
            }));
          } catch (error) {
            console.error("submitAssignment:storage", error);
          }
        }
        return;
      }

      patchState((draft) => {
        draft.entriesByRoom[activeRoom.id] = [
          ...(draft.entriesByRoom[activeRoom.id] ?? []),
          makeEntry(
            activeRoom.id,
            assignment.chainId,
            assignment.round,
            assignment.kind,
            currentParticipant.id,
            currentParticipant.displayName,
            content,
          ),
        ];

        return automateAiAndProgress(draft, activeRoom.id);
      });
    } catch (error) {
      console.error("submitAssignment", error);
      setToast("제출 중 문제가 생겼어요");
    }
  }

  async function sendChatMessage() {
    if (!activeRoom || !currentUser || !composer.trim()) {
      return;
    }

    if (isFirebaseMode && firebaseDb) {
      await setDoc(
        doc(collection(firebaseDb, "rooms", activeRoom.id, "chatMessages")),
        makeChatMessage(activeRoom.id, currentUser.id, currentUser.displayName, composer.trim()),
      );
      setComposer("");
      return;
    }

    patchState((draft) => {
      draft.messagesByRoom[activeRoom.id] = [
        ...(draft.messagesByRoom[activeRoom.id] ?? []),
        makeChatMessage(activeRoom.id, currentUser.id, currentUser.displayName, composer.trim()),
      ];
    });
    setComposer("");
  }

  async function leaveRoom() {
    if (!activeRoom || !currentUser) {
      setActiveRoomId(null);
      setPendingInviteCode(null);
      return;
    }

    if (isFirebaseMode && firebaseDb) {
      if (activeRoom.hostId === currentUser.id) {
        await endRoom();
        return;
      }

      await deleteDoc(doc(firebaseDb, "rooms", activeRoom.id, "roomParticipants", currentUser.id));
      setActiveRoomId(null);
      setPendingInviteCode(null);
      setToast("방에서 나갔어요");
      return;
    }

    patchState((draft) => {
      if (activeRoom.hostId === currentUser.id) {
        delete draft.rooms[activeRoom.id];
        delete draft.participantsByRoom[activeRoom.id];
        delete draft.entriesByRoom[activeRoom.id];
        delete draft.messagesByRoom[activeRoom.id];
        delete draft.sessionsByRoom[activeRoom.id];
        draft.activeRoomId = null;
        return draft;
      }

      draft.participantsByRoom[activeRoom.id] = (draft.participantsByRoom[activeRoom.id] ?? []).filter(
        (participant) => participant.id !== currentUser.id,
      );
      draft.messagesByRoom[activeRoom.id] = [
        ...(draft.messagesByRoom[activeRoom.id] ?? []),
        makeChatMessage(activeRoom.id, "system", "Mugurige", `${currentUser.displayName} 님이 방에서 나갔어요.`),
      ];
      draft.activeRoomId = null;
      return draft;
    });

    setPendingInviteCode(null);
    setToast(activeRoom.hostId === currentUser.id ? "방을 종료했어요" : "방에서 나갔어요");
  }

  async function copyInviteLink() {
    if (!activeRoom || typeof window === "undefined") {
      setToast("복사할 방 링크가 없어요");
      return;
    }

    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${activeRoom.inviteCode}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setToast("방 링크를 복사했어요");
    } catch {
      setToast("링크 복사에 실패했어요");
    }
  }

  async function restartRoom() {
    if (!activeRoom || !currentUser || activeRoom.hostId !== currentUser.id) {
      return;
    }

    if (isFirebaseMode && firebaseDb) {
      const entrySnapshot = await getDocs(collection(firebaseDb, "rooms", activeRoom.id, "entries"));
      await Promise.all(entrySnapshot.docs.map((item) => deleteDoc(item.ref)));
      const sessionRef = doc(firebaseDb, "rooms", activeRoom.id, "gameSessions", "current");
      await Promise.all([
        deleteDoc(sessionRef).catch(() => undefined),
        updateDoc(doc(firebaseDb, "rooms", activeRoom.id), { status: "lobby" }),
        setDoc(
          doc(collection(firebaseDb, "rooms", activeRoom.id, "chatMessages")),
          makeChatMessage(activeRoom.id, "system", "Mugurige", "새 게임을 준비 중이에요. 다시 시작해 볼까요?"),
        ),
      ]);
      return;
    }

    patchState((draft) => {
      draft.rooms[activeRoom.id].status = "lobby";
      draft.entriesByRoom[activeRoom.id] = [];
      delete draft.sessionsByRoom[activeRoom.id];
      draft.messagesByRoom[activeRoom.id] = [
        ...(draft.messagesByRoom[activeRoom.id] ?? []),
        makeChatMessage(activeRoom.id, "system", "Mugurige", "새 게임을 준비 중이에요. 다시 시작해 볼까요?"),
      ];
    });
  }

  async function endRoom() {
    if (!activeRoom) {
      return;
    }

    if (isFirebaseMode && firebaseDb) {
      const [participantSnapshot, messageSnapshot, entrySnapshot, sessionSnapshot] = await Promise.all([
        getDocs(collection(firebaseDb, "rooms", activeRoom.id, "roomParticipants")),
        getDocs(collection(firebaseDb, "rooms", activeRoom.id, "chatMessages")),
        getDocs(collection(firebaseDb, "rooms", activeRoom.id, "entries")),
        getDocs(collection(firebaseDb, "rooms", activeRoom.id, "gameSessions")),
      ]);

      await Promise.all([
        ...participantSnapshot.docs.map((item) => deleteDoc(item.ref)),
        ...messageSnapshot.docs.map((item) => deleteDoc(item.ref)),
        ...entrySnapshot.docs.map((item) => deleteDoc(item.ref)),
        ...sessionSnapshot.docs.map((item) => deleteDoc(item.ref)),
      ]);
      await deleteDoc(doc(firebaseDb, "rooms", activeRoom.id));
      setActiveRoomId(null);
      setPendingInviteCode(null);
      setToast("방을 종료하고 데이터를 정리했어요");
      return;
    }

    patchState((draft) => {
      delete draft.rooms[activeRoom.id];
      delete draft.participantsByRoom[activeRoom.id];
      delete draft.entriesByRoom[activeRoom.id];
      delete draft.messagesByRoom[activeRoom.id];
      delete draft.sessionsByRoom[activeRoom.id];
      draft.activeRoomId = null;
    });
    setPendingInviteCode(null);
    setToast("방을 종료하고 데이터를 정리했어요");
  }

  return {
    activeRoom,
    assignments,
    copyInviteLink,
    composer,
    currentUser,
    isSignedIn: Boolean(state.currentUserId),
    entries,
    firebaseConfigured,
    isFirebaseMode,
    joinCode,
    nicknameDraft,
    messages,
    participants,
    session,
    state,
    toast,
    addAiParticipant,
    createRoom,
    joinRoom,
    leaveRoom,
    restartRoom,
    endRoom,
    saveNickname,
    sendChatMessage,
    setComposer,
    setJoinCode,
    setNicknameDraft,
    signIn,
    signOut,
    startGame,
    submitTextAssignment,
    updatePromptDifficulty,
  };
}
