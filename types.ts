
export interface WordData {
  id: string;
  term: string;
  translation: string; // Turkish
  definition: string; // English
  exampleSentence: string;
  pronunciation: string; // IPA or phonetic
  phoneticSpelling: string; // Simple pronunciation guide
  type: string; // noun, verb, etc.
  audioBase64?: string; // AI Generated PCM Audio
  mnemonic?: string; // Memory aid hook
  visualScene?: string; // AI Generated visual mnemonic
  origin?: string; // Etymology or word history
}

export interface WritingFeedback {
  score: number; // 0-100
  cefrLevel: string; // A1-C2
  feedback: string;
  corrections: { original: string; corrected: string; reason: string }[];
  suggestions: string[]; // Better vocabulary choices
}

export interface SRSState {
  nextReview: number; // Timestamp
  interval: number; // Days
  easeFactor: number; // Multiplier
  streak: number;
}

export interface SRSHistoryItem {
  date: number;
  grade: 'again' | 'hard' | 'good' | 'easy';
  interval: number;
}

export interface UserWord extends WordData {
  srs: SRSState;
  dateAdded: number;
  history?: SRSHistoryItem[];
}

export enum AppView {
  AUTH = 'AUTH',
  ONBOARDING = 'ONBOARDING',
  DASHBOARD = 'DASHBOARD',
  STUDY = 'STUDY',
  DISCOVER = 'DISCOVER',
  STUDIO = 'STUDIO',
  PROFILE = 'PROFILE',
  GAMES = 'GAMES',
  SETTINGS = 'SETTINGS',
  VOICE_TALK = 'VOICE_TALK',
  COLLECTION = 'COLLECTION'
}

export type StudyMode = 'meaning' | 'context' | 'writing' | 'speaking' | 'translation';

export type UserLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type UserGoal = 'General English' | 'IELTS' | 'TOEFL' | 'SAT' | 'Business' | 'Travel';
export type AppTheme = 'light' | 'dark' | 'system';

export interface Quest {
  id: string;
  title: string;
  icon: string;
  target: number;
  progress: number;
  completed: boolean;
  rewardXP: number;
  type: 'study_words' | 'play_games' | 'read_story' | 'add_words' | 'writing_lab';
}

export interface UserProfile {
  uid?: string;
  email?: string;
  username?: string;
  avatar: string;
  level: UserLevel;
  goal: UserGoal;
  hasCompletedOnboarding: boolean;
  hasSeenTour: boolean;
  dailyTarget: number;
  studyTime: string;
  lastGeneratedDate: string;
  wordsStudiedToday: number;
  lastStudyDate: string;
  xp: number;
  streakFreeze: number;
  streak: number;
  longestStreak: number;
  league: UserLeague;
  theme: AppTheme;
  quests?: Quest[];
  lastQuestDate?: string;
  settings: {
    autoPlayAudio: boolean;
    notifications: boolean;
    soundEffects: boolean;
  };
}

export type UserLeague = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export interface GeneratedStory {
  id: string;
  title: string;
  content: string;
  genre: string;
  level: string;
  coverGradient: string;
  date: number;
  vocabulary: WordData[];
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    text: string;
    correction?: string;
    timestamp: number;
}

export interface VoiceSession {
    id: string;
    timestamp: number;
    scenario: string;
    duration: number; // saniye
    transcript: ChatMessage[];
    analysis?: {
        fluencyScore: number;
        grammarFeedback: string;
        vocabularyUsed: string[];
        suggestions: string[];
    };
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  xp: number;
  avatar: string;
  rank: number;
  isCurrentUser?: boolean;
}
