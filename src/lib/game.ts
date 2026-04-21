import type {
  Assignment,
  ChatMessage,
  Entry,
  EntryKind,
  GameMode,
  ModeCard,
  Participant,
  PersistedState,
  Room,
  UserProfile,
} from "../types";

const promptSeeds = [
  "우주에서 라면 먹는 고양이",
  "무지개 위를 달리는 수달",
  "딸기 케이크를 지키는 용",
  "하품하는 해적 펭귄",
  "번개를 타는 체리 토끼",
  "비밀 지도를 찾은 문어",
];

const aiNames = ["모찌봇", "체리봇", "반짝이", "구름펜", "별콩이", "스케치봇"];

export const modeCards: ModeCard[] = [
  {
    id: "relay",
    title: "릴레이 모드",
    subtitle: "그림으로 말하는 텔레스트레이션",
    description: "제시어를 그리고, 다음 사람이 추측하고, 다시 그리며 웃음 폭탄 결과를 만드는 메인 모드",
    badge: "Now Playing",
    enabled: true,
  },
  {
    id: "mafia",
    title: "마피아 모드",
    subtitle: "누가 그림 속 진실을 숨기고 있을까",
    description: "역할과 거짓말이 섞인 추리형 모드",
    badge: "Coming Soon",
    enabled: false,
  },
  {
    id: "speed",
    title: "스피드 모드",
    subtitle: "짧게 그리고 빠르게 넘기는 텐션 모드",
    description: "시간 압박 속에서 터지는 빠른 라운드 플레이",
    badge: "Coming Soon",
    enabled: false,
  },
  {
    id: "aiVillain",
    title: "AI 빌런 모드",
    subtitle: "AI가 판을 흔드는 예측 불가 모드",
    description: "의도적으로 어지럽히는 AI 빌런이 끼어드는 변칙 모드",
    badge: "Coming Soon",
    enabled: false,
  },
  {
    id: "blind",
    title: "눈감고 모드",
    subtitle: "감각을 믿고 그리는 혼돈 모드",
    description: "시야 제약과 손맛 중심의 도전 모드",
    badge: "Coming Soon",
    enabled: false,
  },
];

export const initialState: PersistedState = {
  currentUserId: null,
  users: {},
  rooms: {},
  participantsByRoom: {},
  sessionsByRoom: {},
  entriesByRoom: {},
  messagesByRoom: {},
  activeRoomId: null,
};

export function getMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function ensureMonthlyCredits(user: UserProfile): UserProfile {
  const monthKey = getMonthKey();
  if (user.creditResetAt === monthKey) {
    return user;
  }

  return {
    ...user,
    creditResetAt: monthKey,
    monthlyCredits: 10,
  };
}

export function generateInviteCode(existingCodes: string[]): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let next = "";

  do {
    next = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (existingCodes.includes(next));

  return next;
}

export function makeUser(): UserProfile {
  const displayName = `${["말랑", "반짝", "체리", "푸름", "몽글"][Math.floor(Math.random() * 5)]}${["연필", "토끼", "고양이", "구름", "별"][Math.floor(Math.random() * 5)]}`;

  return {
    id: crypto.randomUUID(),
    displayName,
    photoUrl: `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(displayName)}`,
    monthlyCredits: 10,
    creditResetAt: getMonthKey(),
    provider: "local",
  };
}

export function makeParticipant(
  roomId: string,
  displayName: string,
  isAi: boolean,
  turnOrder: number,
  id: string = crypto.randomUUID(),
): Participant {
  return {
    id,
    roomId,
    displayName,
    isAi,
    turnOrder,
    joinedAt: Date.now(),
    ready: false,
    avatarHue: Math.floor(Math.random() * 360),
  };
}

export function getRoomParticipants(state: PersistedState, roomId: string): Participant[] {
  return [...(state.participantsByRoom[roomId] ?? [])].sort((a, b) => a.turnOrder - b.turnOrder);
}

export function getRoomEntries(state: PersistedState, roomId: string): Entry[] {
  return [...(state.entriesByRoom[roomId] ?? [])].sort((a, b) => a.createdAt - b.createdAt);
}

export function getRoundKind(round: number): EntryKind {
  if (round === 0) {
    return "prompt";
  }

  return round % 2 === 1 ? "drawing" : "guess";
}

export function getRoundLabel(round: number): string {
  const kind = getRoundKind(round);
  if (kind === "prompt") {
    return "시작 제시어";
  }
  if (kind === "drawing") {
    return "그림 그리기";
  }
  return "추측 작성";
}

export function getAssignmentsForParticipant(
  state: PersistedState,
  roomId: string,
  participantId: string,
): Assignment[] {
  const session = state.sessionsByRoom[roomId];
  const participants = getRoomParticipants(state, roomId);
  const entries = getRoomEntries(state, roomId);

  if (!session || participants.length === 0) {
    return [];
  }

  const assignments: Assignment[] = [];

  participants.forEach((starter, starterIndex) => {
    const assignee = participants[(starterIndex + session.currentRound) % participants.length];
    if (assignee.id !== participantId) {
      return;
    }

    const previousEntry =
      session.currentRound > 0
        ? entries.find((entry) => entry.chainId === starter.id && entry.round === session.currentRound - 1)
        : undefined;
    const currentEntry = entries.find((entry) => entry.chainId === starter.id && entry.round === session.currentRound);

    assignments.push({
      chainId: starter.id,
      round: session.currentRound,
      kind: getRoundKind(session.currentRound),
      starter,
      assignee,
      previousEntry,
      currentEntry,
    });
  });

  return assignments;
}

export function getRevealChains(state: PersistedState, roomId: string): Array<{ starter: Participant; entries: Entry[] }> {
  const participants = getRoomParticipants(state, roomId);
  const entries = getRoomEntries(state, roomId);

  return participants.map((starter) => ({
    starter,
    entries: entries.filter((entry) => entry.chainId === starter.id).sort((a, b) => a.round - b.round),
  }));
}

export function getCurrentUser(state: PersistedState): UserProfile | null {
  if (!state.currentUserId) {
    return null;
  }

  const user = state.users[state.currentUserId];
  if (user) {
    return ensureMonthlyCredits(user);
  }

  const fallback = Object.values(state.users).find((item) => item.id === state.currentUserId);
  return fallback ? ensureMonthlyCredits(fallback) : null;
}

export function makeRoom(hostId: string, mode: GameMode): Room {
  return {
    id: crypto.randomUUID(),
    mode,
    hostId,
    inviteCode: "",
    status: "lobby",
    createdAt: Date.now(),
    settings: {
      roundLimit: 6,
    },
  };
}

export function makeChatMessage(roomId: string, authorId: string, authorName: string, content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    roomId,
    authorId,
    authorName,
    content,
    createdAt: Date.now(),
  };
}

export function makeEntry(
  roomId: string,
  chainId: string,
  round: number,
  kind: EntryKind,
  authorId: string,
  participantName: string,
  content: string,
  id: string = crypto.randomUUID(),
): Entry {
  return {
    id,
    roomId,
    chainId,
    round,
    kind,
    authorId,
    participantName,
    content,
    createdAt: Date.now(),
  };
}

export function pickAiName(): string {
  return aiNames[Math.floor(Math.random() * aiNames.length)];
}

export function makeAiPrompt(): string {
  return promptSeeds[Math.floor(Math.random() * promptSeeds.length)];
}

export function makeAiGuess(previous: string): string {
  if (previous.includes("고양이")) {
    return "우주를 여행하는 고양이 같아요";
  }
  if (previous.includes("용")) {
    return "케이크를 지키는 용처럼 보여요";
  }
  if (previous.includes("토끼")) {
    return "무언가 위를 달리는 토끼 같아요";
  }
  return "왠지 엄청 진지한 모험 장면 같아요";
}

export function makeAiDrawing(prompt: string): string {
  const safePrompt = prompt.slice(0, 22);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
      <rect width="640" height="420" rx="28" fill="#fffbe6"/>
      <path d="M80 320 C180 80, 420 80, 560 320" fill="none" stroke="#5b7cfa" stroke-width="18" stroke-linecap="round"/>
      <circle cx="220" cy="190" r="54" fill="#ff9ec9"/>
      <circle cx="390" cy="190" r="66" fill="#ffd15c"/>
      <path d="M160 290 Q320 160 500 300" fill="none" stroke="#0f766e" stroke-width="14" stroke-linecap="round"/>
      <path d="M110 120 L150 70 L190 120" fill="none" stroke="#111827" stroke-width="10" stroke-linecap="round"/>
      <path d="M410 110 L470 90 L500 140" fill="none" stroke="#ef4444" stroke-width="10" stroke-linecap="round"/>
      <text x="320" y="360" text-anchor="middle" font-size="28" font-family="Verdana" fill="#1f2937">${safePrompt}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function roomProgressText(state: PersistedState, roomId: string): string {
  const session = state.sessionsByRoom[roomId];
  if (!session) {
    return "아직 게임이 시작되지 않았어요.";
  }

  return `${session.currentRound + 1} / ${session.totalRounds} 라운드 · ${getRoundLabel(session.currentRound)}`;
}
