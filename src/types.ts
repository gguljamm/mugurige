export type GameMode = "relay" | "mafia" | "speed" | "aiVillain" | "blind";

export type RoomStatus = "lobby" | "playing" | "results";

export type EntryKind = "prompt" | "drawing" | "guess";

export interface UserProfile {
  id: string;
  displayName: string;
  photoUrl: string;
  monthlyCredits: number;
  creditResetAt: string;
  provider: "google" | "local";
}

export interface RoomSettings {
  roundLimit: number;
}

export interface Room {
  id: string;
  mode: GameMode;
  hostId: string;
  inviteCode: string;
  status: RoomStatus;
  createdAt: number;
  settings: RoomSettings;
}

export interface Participant {
  id: string;
  roomId: string;
  displayName: string;
  isAi: boolean;
  turnOrder: number;
  joinedAt: number;
  ready: boolean;
  avatarHue: number;
}

export interface GameSession {
  roomId: string;
  currentRound: number;
  totalRounds: number;
  startedAt: number;
  completedAt?: number;
}

export interface Entry {
  id: string;
  roomId: string;
  chainId: string;
  round: number;
  kind: EntryKind;
  authorId: string;
  participantName: string;
  content: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: number;
}

export interface PersistedState {
  currentUserId: string | null;
  users: Record<string, UserProfile>;
  rooms: Record<string, Room>;
  participantsByRoom: Record<string, Participant[]>;
  sessionsByRoom: Record<string, GameSession>;
  entriesByRoom: Record<string, Entry[]>;
  messagesByRoom: Record<string, ChatMessage[]>;
  activeRoomId: string | null;
}

export interface Assignment {
  chainId: string;
  round: number;
  kind: EntryKind;
  starter: Participant;
  assignee: Participant;
  previousEntry?: Entry;
  currentEntry?: Entry;
}

export interface ModeCard {
  id: GameMode;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  enabled: boolean;
}
