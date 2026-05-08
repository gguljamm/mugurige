import type {
  Assignment,
  ChatMessage,
  Entry,
  EntryKind,
  GameMode,
  ModeCard,
  Participant,
  PersistedState,
  PromptDifficulty,
  Room,
  UserProfile,
} from "../types";

const EASY_PROMPTS = [
  "홍합", "축제", "서류가방", "포니테일", "구미호", "우산", "사과", "풍선", "해바라기", "연필",
  "도넛", "수박", "비눗방울", "기차", "토끼", "얼음컵", "별", "고래", "피아노", "카메라",
  "축구공", "라면", "모자", "케이크", "양말", "고양이", "강아지", "바나나", "솜사탕", "전화기",
  "쿠키", "연못", "벚꽃", "선인장", "호랑이", "공원", "사자", "공책", "열쇠", "편지",
  "의자", "달", "초콜릿", "빗", "마카롱", "기린", "지갑", "손전등", "목걸이", "아이스크림",
  "비행기", "나무", "피자", "촛불", "안경", "햄버거", "등대", "해적선", "치즈", "커튼",
  "시계", "우체통", "공룡", "감자튀김", "베개", "브로콜리", "눈사람", "장갑", "찻잔", "문어",
  "지도", "진주", "우편함", "딸기", "복숭아", "바이올린", "프라이팬", "마술봉", "새싹", "비둘기",
  "솜인형", "물고기", "불꽃놀이", "버스", "눈사람", "왕관", "스케이트", "귤", "에메랄드", "종이학",
  "청개구리", "후라이드치킨", "모래성", "고무오리", "케찹", "파도", "목도리", "자전거", "알람시계", "풍차",
];

const MEDIUM_PROMPTS = [
  "엽서", "조각 케이크", "아포가토", "대장간", "벼락치기 공부", "하프", "빈티지 찻집", "야간 열차", "캠코더", "연극 무대",
  "고장 난 자판기", "장미 정원", "달빛 산책", "유리병 편지", "회전목마", "수채화 붓", "낚싯배", "초대장", "젤리 샌들", "방명록",
  "우체국 창구", "양초 공방", "노천 카페", "불가사리", "사파리 모자", "봉제인형 가게", "빙수 그릇", "손거울", "필름 카메라", "목공예",
  "유리 온실", "커피 그라인더", "자개함", "달걀말이", "플라네타륨", "풍경화", "과수원", "분수대", "스노우볼", "도예 수업",
  "손글씨 메모", "빵 바구니", "하교길", "나침반", "트램펄린", "캠핑 랜턴", "별자리 책", "놀이동산 지도", "모닥불", "단추 상자",
  "유람선", "조개 목걸이", "초코 크루아상", "탁상시계", "낡은 다이어리", "머핀 틀", "치즈 플래터", "벽난로", "비밀 계단", "주스 바",
  "음악 상자", "다락방", "손수건", "가죽 부츠", "고양이 카페", "모노레일", "썰매장", "노을 사진", "털실 뭉치", "연습장",
  "오르골", "밤하늘 포스터", "라탄 의자", "유리잔", "꽃시장", "야시장 간판", "식물 표본", "미니 화분", "퍼레이드", "비치볼",
  "온천 마을", "종이배", "디저트 포크", "골동품 상점", "우유 거품", "대합실", "공예용 가위", "바닷가 산책로", "별 모양 쿠션", "과일 타르트",
  "거리 공연", "머그컵 선반", "스케치북", "풍등", "카세트테이프", "마들렌", "유채꽃밭", "한입 샌드위치", "꽃병", "코코아 잔",
];

const HARD_PROMPTS = [
  "젤리 왕관을 쓴 야시장 DJ", "분홍 네온이 새는 고래 우체국", "레몬소다 파도 위의 비밀 결혼식", "글리터가 쏟아지는 지하철 종점", "체리 헤드셋을 낀 유령 점원",
  "마시멜로 천장 아래의 수상한 졸업식", "하트 스티커로 봉인된 시간여행 택시", "사탕 유리창이 달린 심야 세탁소", "별사탕 눈보라 속 비밀 오디션", "리본 번개가 치는 옥상 수영장",
  "우주 젤리 공장에서 길 잃은 펭귄 인턴", "야광 조개가 안내하는 파자마 퍼레이드", "민트초코 행성의 불시착 기자회견", "오로라 푸딩을 배달하는 구름 기사", "무지개 연기가 나는 연습실",
  "체리 폭죽을 숨긴 발레리나 해적단", "딸기 시럽 비가 내리는 야간 캠핑장", "반짝 먼지로 운영되는 수상한 서점", "장난감 행성 박물관의 폐관 5분 전", "유리꽃을 재배하는 해변 카센터",
  "하트 선글라스를 낀 목성 카우보이", "형광 스프를 끓이는 달나라 식당", "펄 리본을 단 괴도 아이스크림", "버블티 화산이 깨어난 축제 거리", "비밀 코드가 적힌 컵케이크 합창단",
  "네온 체리를 훔쳐 달아난 토끼 요원", "우산 없이 입장 금지인 별빛 무도회", "타자기 소리로만 움직이는 유원지", "야광 스웨터를 입은 심해 악단", "거울 호수 위 종이배 패션쇼",
  "젤리빈으로 만든 응급 탈출 버튼", "풍선 달이 떠 있는 폐허의 포토부스", "우주 미아를 찾는 솜사탕 관제실", "리본이 말을 거는 새벽 편의점", "유령이 운영하는 페디큐어 살롱",
  "초승달 목걸이를 배송하는 괴짜 기사", "레트로 게임기 속 벚꽃 파업", "장미 거품이 넘치는 잠수함 라운지", "고래 별자리를 수리하는 기술자", "형광 핫도그 트럭의 비밀 메뉴",
  "하모니카 소리로 열리는 글리터 지하문", "안개 속 네온 회전목마 정비소", "반짝 호박을 조각하는 마녀 밴드", "우주 라디오를 줍는 해변 소녀", "번개 젤리로 충전되는 놀이기구",
  "보석 스티커를 떼면 멈추는 시간", "별빛 드레스를 세탁하는 유령 재봉사", "마카롱 성벽 아래의 비밀 탈옥", "달무리 속에서 열리는 롤러스케이트 재판", "복숭아 향 안개를 뿜는 잠자리 열차",
  "스팽글 고양이가 지키는 무인 매표소", "핫핑크 구름 창고의 분실물 센터", "펄 크림이 흐르는 카니발 분수", "잼 잔디가 깔린 옥상 정원", "빙하 조명 아래 펼쳐지는 하프 독주회",
  "별가루 알약을 훔친 천문학 동아리", "체리 립스틱이 남겨진 비밀 통로", "어둠 속에서만 피는 네온 해바라기", "초콜릿 번개에 맞은 대관람차", "거울 미로 끝의 젤리 우편함",
  "블루레몬 소다를 숭배하는 고래 합창단", "사탕 조약돌 해변의 실종 사건", "보라 안개가 가득한 지붕 없는 호텔", "리본 폭포 옆 팝콘 성당", "우주 토끼가 남긴 야광 낙서",
  "물감 대신 별빛을 쓰는 화실", "후르츠 펀치 호수의 비밀 잠수부", "알람시계가 춤추는 졸린 극장", "야광 튤립이 줄 선 지하 상점가", "하트 모양 구름을 경비하는 요원",
  "젤리 슈트를 입은 도서관 탈주범", "민트 안개가 새는 연못 위 오케스트라", "복숭아 행성 관광버스 파업 현장", "펄 소음을 수집하는 심야 방송국", "장난감 번개를 파는 벼룩시장",
  "블랙체리 커튼 뒤 비밀 대기실", "하늘색 버터크림으로 덮인 기차역", "리본 혜성이 떨어진 체육관", "밤하늘 포장지에 감긴 선물탑", "숨겨진 출구가 있는 달빛 온실",
  "오로라 토마토를 경매하는 선장", "형광 모래시계가 멈춘 파티룸", "캔디 우주복 수리점의 막내 기사", "박수 소리로 켜지는 별빛 호텔", "버블 껌 구름이 낮게 깔린 부두",
  "유리별이 부서진 뒤의 발레 연습실", "무지개 복도 끝에 있는 밀크티 재판소", "네온 파인애플을 심는 정원사", "수상한 크림소다 연구소 야근", "초승달 브로치 분실사건 현장",
  "펄 조개 키보드로 여는 비상회의", "하트 풍선이 잠든 버스 차고지", "캔디 드럼을 치는 해적 오케스트라", "핑크 안개 속 소방 훈련", "체리 별빛이 샘솟는 모래사막 휴게소",
];

const aiNames = ["모찌봇", "체리봇", "반짝이", "구름펜", "별콩이", "스케치봇"];

export const modeCards: ModeCard[] = [
  {
    id: "relay",
    title: "릴레이 모드",
    subtitle: "그림으로 말하는 텔레스트레이션",
    description: "각자 다른 제시어를 받고, 그림과 추측을 주고받으며 한 바퀴를 도는 메인 모드",
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
    accountName: displayName,
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

export function sortParticipants(participants: Participant[]): Participant[] {
  return [...participants].sort((a, b) => {
    if (a.turnOrder !== b.turnOrder) {
      return a.turnOrder - b.turnOrder;
    }
    if (a.joinedAt !== b.joinedAt) {
      return a.joinedAt - b.joinedAt;
    }
    return a.id.localeCompare(b.id);
  });
}

export function getRoomParticipants(state: PersistedState, roomId: string): Participant[] {
  return sortParticipants(state.participantsByRoom[roomId] ?? []);
}

export function getRoomEntries(state: PersistedState, roomId: string): Entry[] {
  return [...(state.entriesByRoom[roomId] ?? [])].sort((a, b) => a.round - b.round || a.createdAt - b.createdAt);
}

export function getStageKind(round: number): EntryKind {
  if (round === 0) {
    return "prompt";
  }

  return round % 2 === 1 ? "drawing" : "guess";
}

export function getRoundLabel(round: number): string {
  const kind = getStageKind(round);
  if (kind === "prompt") {
    return "제시어 확인";
  }
  if (kind === "drawing") {
    return "그림 그리기";
  }
  return "제시어 맞추기";
}

function getInitialOffset(participantCount: number): number {
  return participantCount % 2 === 0 ? 0 : 1;
}

export function getTotalPlayableRounds(participantCount: number): number {
  return participantCount - getInitialOffset(participantCount);
}

export function getAssigneeForRound(
  participants: Participant[],
  chainStarterIndex: number,
  round: number,
  initialOffset = getInitialOffset(participants.length),
): Participant | undefined {
  if (participants.length === 0 || round <= 0) {
    return undefined;
  }

  const assigneeIndex = (chainStarterIndex + initialOffset + (round - 1)) % participants.length;
  return participants[assigneeIndex];
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

  if (session.currentRound === 0) {
    const starter = participants.find((participant) => participant.id === participantId);
    const currentEntry = entries.find((entry) => entry.chainId === participantId && entry.round === 0);
    if (!starter || !currentEntry) {
      return [];
    }

    return [
      {
        chainId: starter.id,
        round: 0,
        kind: "prompt",
        starter,
        assignee: starter,
        currentEntry,
      },
    ];
  }

  participants.forEach((starter, starterIndex) => {
    const assignee = getAssigneeForRound(participants, starterIndex, session.currentRound, session.initialOffset);
    if (!assignee || assignee.id !== participantId) {
      return;
    }

    const previousEntry = entries.find(
      (entry) => entry.chainId === starter.id && entry.round === session.currentRound - 1,
    );
    const currentEntry = entries.find(
      (entry) => entry.chainId === starter.id && entry.round === session.currentRound,
    );

    assignments.push({
      chainId: starter.id,
      round: session.currentRound,
      kind: getStageKind(session.currentRound),
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
      promptDifficulty: "medium",
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

export function getPromptPoolByDifficulty(difficulty: PromptDifficulty): string[] {
  if (difficulty === "easy") {
    return EASY_PROMPTS;
  }
  if (difficulty === "hard") {
    return HARD_PROMPTS;
  }
  return MEDIUM_PROMPTS;
}

export function pickPromptBatch(difficulty: PromptDifficulty, count: number): string[] {
  const pool = [...getPromptPoolByDifficulty(difficulty)];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool.slice(0, count);
}

export function makeAiGuess(previous: string): string {
  if (previous.includes("우주") || previous.includes("별")) {
    return "우주 느낌의 키치한 장면 같아요";
  }
  if (previous.includes("케이크") || previous.includes("푸딩")) {
    return "디저트가 중심인 장면처럼 보여요";
  }
  if (previous.includes("고양이") || previous.includes("토끼")) {
    return "동물이 주인공인 이야기 같아요";
  }
  return "반짝이고 조금 수상한 장면 같아요";
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

  return `${session.currentRound} / ${session.totalRounds} 스테이지 · ${getRoundLabel(session.currentRound)}`;
}

export function getStageDurationSeconds(round: number): number {
  if (round === 0) {
    return 5;
  }

  return getStageKind(round) === "drawing" ? 40 : 15;
}
