export type Role = 'villager' | 'werewolf' | 'seer' | 'witch' | 'hunter';

export type Camp = 'good' | 'wolf';

export type GamePhase = 'night' | 'day' | 'vote' | 'lastWords' | 'result';

export type GameMode = 'play' | 'watch';

export interface AiProfile {
  id: string;
  name: string;
  provider: string;
  avatar: string;
  temperament: string;
  playStyle: string;
  strength: string;
  risk: string;
  color: string;
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  camp: Camp;
  isUser: boolean;
  isAlive: boolean;
  deathDay?: number;
  deathReason?: 'night' | 'vote' | 'poison' | 'shot';
  profile?: AiProfile;
}

export interface Speech {
  id: string;
  day: number;
  phase: GamePhase;
  playerId: string;
  playerName: string;
  content: string;
  tone: string;
  source?: 'qwen' | 'kimi' | 'cloud_fallback' | 'local_fallback' | 'user';
}

export interface VoteRecord {
  voterId: string;
  targetId: string;
}

export interface SeerCheckRecord {
  day: number;
  targetId: string;
  targetName: string;
  targetRole: Role;
  targetCamp: Camp;
}

export interface NightRecord {
  day: number;
  wolfTargetId?: string;
  wolfTargetName?: string;
  witchSaved: boolean;
  witchPoisonTargetId?: string;
  witchPoisonTargetName?: string;
  deadPlayerIds: string[];
  announcement: string;
}

export interface WitchNightAction {
  useAntidote: boolean;
  usePoison: boolean;
  poisonTargetId?: string;
}

export interface LastWordsRecord {
  day: number;
  playerId: string;
  playerName: string;
  content: string;
}

export interface GameState {
  mode: GameMode;
  userRole?: Role;
  day: number;
  phase: GamePhase;
  players: Player[];
  speakingOrder: string[];
  spokenPlayerIds: string[];
  speeches: Speech[];
  votes: VoteRecord[];
  seerChecks: SeerCheckRecord[];
  nightRecords: NightRecord[];
  lastWords: LastWordsRecord[];
  eliminatedPlayerId?: string;
  winner?: Camp;
  userSpeechDraft: string;
  coachTip: string;
}

export interface ReviewInsight {
  title: string;
  content: string;
  level: 'good' | 'warning' | 'info';
}

export interface AiPlayerContext {
  id: string;
  name: string;
  seat: number;
  role: Role;
  camp: Camp;
  isUser: boolean;
  isAlive: boolean;
  deathReason?: Player['deathReason'];
  temperament?: string;
  playStyle?: string;
  strength?: string;
  risk?: string;
}

export interface AiChatRequest {
  day: number;
  mode: GameMode;
  phase: GamePhase;
  currentSpeakerId?: string;
  currentSpeakerIndex?: number;
  targetPlayerIds?: string[];
  speakingOrder?: string[];
  spokenPlayerIds?: string[];
  unspokenPlayerIds?: string[];
  players: AiPlayerContext[];
  publicSpeeches: Array<Pick<Speech, 'playerId' | 'playerName' | 'content' | 'day'>>;
  publicEvents: string[];
  seerChecks?: SeerCheckRecord[];
  nightRecords?: NightRecord[];
}

export interface AiSpeechResult {
  playerId: string;
  content: string;
  source?: 'qwen' | 'kimi' | 'cloud_fallback';
}

export interface AiChatResponse {
  speeches: AiSpeechResult[];
  source: 'qwen' | 'kimi' | 'fallback' | 'mock';
  model: string;
}
