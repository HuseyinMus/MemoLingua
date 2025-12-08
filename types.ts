
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
  STUDIO = 'STUDIO', // Renamed from STORIES to STUDIO
  PROFILE = 'PROFILE',
  ARENA = 'ARENA',
  SETTINGS = 'SETTINGS',
}

export type StudyMode = 'meaning' | 'context' | 'writing' | 'speaking' | 'translation';

// User Profile Types
export type UserLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type UserGoal = 'General English' | 'IELTS' | 'TOEFL' | 'SAT' | 'Business' | 'Travel';
export type AppTheme = 'light' | 'dark' | 'system';

export interface UserProfile {
  uid?: string; // Firebase Auth ID
  email?: string;
  username?: string;
  avatar: string; // Selected Avatar Emoji
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
  streak: number; // Current streak
  longestStreak: number; // Best streak
  league: UserLeague;
  theme: AppTheme;
  settings: {
    autoPlayAudio: boolean;
    notifications: boolean;
    soundEffects: boolean;
  };
}

export type UserLeague = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: any;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  type?: 'streak' | 'xp' | 'count'; // Added optional type for better handling
}

export interface GeneratedStory {
  id: string;
  title: string;
  content: string; // Markdown/Text content
  genre: string; // e.g., 'Sci-Fi', 'Mystery'
  level: string;
  coverGradient: string; // CSS class for gradient
  date: number;
  vocabulary: WordData[]; // Pre-generated vocabulary from the story
}

// Roleplay / Chat Types
export interface ChatScenario {
    id: string;
    title: string;
    description: string;
    icon: string; // Emoji
    initialMessage: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    gradient: string;
}

export interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    correction?: string; // Optional grammar correction for user messages
    timestamp: number;
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
