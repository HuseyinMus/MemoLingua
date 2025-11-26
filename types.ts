
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
}

export interface SRSState {
  nextReview: number; // Timestamp
  interval: number; // Days
  easeFactor: number; // Multiplier
  streak: number;
}

export interface UserWord extends WordData {
  srs: SRSState;
  dateAdded: number;
}

export enum AppView {
  AUTH = 'AUTH',
  ONBOARDING = 'ONBOARDING',
  DASHBOARD = 'DASHBOARD',
  STUDY = 'STUDY',
  DISCOVER = 'DISCOVER',
  PROFILE = 'PROFILE',
  ARENA = 'ARENA',
  SETTINGS = 'SETTINGS',
}

export type StudyMode = 'meaning' | 'context' | 'writing' | 'speaking';

// User Profile Types
export type UserLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type UserGoal = 'General English' | 'IELTS' | 'TOEFL' | 'SAT' | 'Business' | 'Travel';
export type AppTheme = 'light' | 'dark' | 'system';

export interface UserProfile {
  uid?: string; // Firebase Auth ID
  email?: string;
  username?: string; // Added username
  level: UserLevel;
  goal: UserGoal;
  hasCompletedOnboarding: boolean;
  hasSeenTour: boolean; // For the tutorial system
  dailyTarget: number;
  studyTime: string; // Preferred study time (e.g. "09:00")
  lastGeneratedDate: string; // To track auto-generation (prevent duplicates on same day)
  wordsStudiedToday: number;
  lastStudyDate: string; // Date string to track daily resets
  xp: number; // Gamification Experience Points
  streakFreeze: number; // Number of freezes available
  theme: AppTheme;
  settings: {
    autoPlayAudio: boolean;
    notifications: boolean;
    soundEffects: boolean;
  };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: any;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
}

export interface GeneratedStory {
  id: string;
  title: string;
  content: string;
  date: number;
  wordIds: string[];
}

// Gamification Types
export interface LeaderboardEntry {
  id: string;
  name: string;
  xp: number;
  avatar: string; // emoji or url
  rank: number;
  isCurrentUser?: boolean;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  expiresIn: string;
  type: 'challenge' | 'tournament' | 'boost';
  color: string;
}

export interface GameMode {
  id: string;
  title: string;
  description: string;
  icon: any;
  players: string;
  status: 'active' | 'coming_soon';
}
