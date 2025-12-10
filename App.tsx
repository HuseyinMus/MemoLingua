// ... existing imports
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserWord, AppView, SRSState, UserProfile, StudyMode, UserLevel, UserGoal, GeneratedStory, Achievement, LeaderboardEntry, WordData, ChatMessage, ChatScenario, SRSHistoryItem } from './types';
import { generateDailyBatch, generateAudio, playGeminiAudio, generateContextualStory, generateSingleWord, generateRoleplayResponse } from './services/geminiService';
import { auth, db } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, writeBatch, query, orderBy, limit } from 'firebase/firestore';

import { Navigation } from './components/Navigation';
import { StudyCard } from './components/StudyCard';
import { Onboarding } from './components/Onboarding';
import { Games } from './components/Games';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { Tour } from './components/Tour';
import { AdBanner } from './components/AdBanner';

import { Sparkles, Zap, Layers, Volume2, Settings as SettingsIcon, ArrowLeft, Trophy, Target, CheckCircle2, MoreHorizontal, BookOpen, Search, ArrowRight, Flame, BrainCircuit, Play, Edit2, X, Send, MessageSquare, Loader2, Snowflake, Lock, Plus, BookMarked, PieChart, TrendingUp, Activity } from 'lucide-react';
// ... existing constants

// ... existing helper functions (deepSanitize, safeStringify, cleanProfile, cleanWord, etc.)
const PROFILE_STORAGE_KEY = 'memolingua_profile_v1';
const STORY_STORAGE_KEY = 'memolingua_stories_v1';

interface SessionResult {
    wordId: string;
    term: string;
    isCorrect: boolean;
    grade: string;
}

function deepSanitize<T>(obj: T, seen = new WeakSet()): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (seen.has(obj)) {
        return '[Circular]' as any;
    }
    
    seen.add(obj);

    if (Array.isArray(obj)) {
        return obj.map(item => deepSanitize(item, seen)) as any;
    }

    const cleaned: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (key.startsWith('_') || key === 'delegate' || key === 'auth' || key === 'proactiveRefresh') continue;
            cleaned[key] = deepSanitize((obj as any)[key], seen);
        }
    }
    return cleaned;
}

const safeStringify = (obj: any) => {
    try {
        return JSON.stringify(deepSanitize(obj));
    } catch (e) {
        console.error("Stringify failed", e);
        return "{}";
    }
};

const cleanProfile = (data: any): UserProfile => {
    if (!data) throw new Error("Profile data is missing");
    
    return {
        email: String(data.email || ''),
        username: String(data.username || 'Student'),
        avatar: String(data.avatar || '🎓'),
        level: (data.level || 'A1') as UserLevel,
        goal: (data.goal || 'General English') as UserGoal,
        hasCompletedOnboarding: !!data.hasCompletedOnboarding,
        hasSeenTour: !!data.hasSeenTour,
        dailyTarget: Number(data.dailyTarget) || 10,
        studyTime: String(data.studyTime || '09:00'),
        lastGeneratedDate: String(data.lastGeneratedDate || ''),
        wordsStudiedToday: Number(data.wordsStudiedToday) || 0,
        lastStudyDate: String(data.lastStudyDate || new Date().toDateString()),
        xp: Number(data.xp) || 0,
        streakFreeze: Number(data.streakFreeze) || 0,
        streak: Number(data.streak) || 0,
        longestStreak: Number(data.longestStreak) || 0,
        league: (data.league || 'Bronze') as any,
        theme: (data.theme || 'system') as any,
        uid: data.uid ? String(data.uid) : undefined,
        settings: {
            autoPlayAudio: !!(data.settings?.autoPlayAudio ?? true),
            notifications: !!(data.settings?.notifications ?? true),
            soundEffects: !!(data.settings?.soundEffects ?? true),
        }
    };
};

const cleanWord = (data: any): UserWord => {
    const word: UserWord = {
        id: String(data.id),
        term: String(data.term || ''),
        translation: String(data.translation || ''),
        definition: String(data.definition || ''),
        exampleSentence: String(data.exampleSentence || ''),
        pronunciation: String(data.pronunciation || ''),
        phoneticSpelling: String(data.phoneticSpelling || ''),
        type: String(data.type || 'noun'),
        dateAdded: Number(data.dateAdded) || Date.now(),
        srs: {
            nextReview: Number(data.srs?.nextReview) || Date.now(),
            interval: Number(data.srs?.interval) || 0,
            easeFactor: Number(data.srs?.easeFactor) || 2.5,
            streak: Number(data.srs?.streak) || 0
        }
    };

    if (data.audioBase64) word.audioBase64 = String(data.audioBase64);
    if (data.mnemonic) word.mnemonic = String(data.mnemonic);
    if (Array.isArray(data.history)) word.history = data.history;

    return word;
};

const INITIAL_STORIES: GeneratedStory[] = [
    {
        id: 'story-1',
        title: 'The Silent Station',
        genre: 'Sci-Fi',
        level: 'B1',
        coverGradient: 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500',
        date: Date.now(),
        content: "The station was silent. Too silent. Commander Kael drifted through the zero-gravity corridor, gripping his plasma wrench. The **artificial** gravity had failed three hours ago, leaving everything floating in a chaotic dance.\n\nHe needed to reach the core. The **reactor** was unstable, pulsing with a dangerous red light. Suddenly, a sound echoed—a metallic clang. He wasn't alone. An alien **entity**, small but fast, darted across the control panel.\n\nKael froze. He had to make a choice: repair the ship or chase the intruder. The survival of his crew depended on this split-second decision.",
        vocabulary: []
    },
    {
        id: 'story-2',
        title: 'Morning in Istanbul',
        genre: 'Travel',
        level: 'A2',
        coverGradient: 'bg-gradient-to-br from-orange-400 via-red-500 to-pink-500',
        date: Date.now(),
        content: "The sun rose over the Bosphorus, painting the water in gold. Elif walked down the narrow **cobblestone** streets of Balat. The smell of fresh bread and strong tea filled the air. Cats slept on the warm hoods of cars.\n\nShe stopped at a small cafe. 'One tea, please,' she asked the old man. He smiled and handed her a glass. The city was waking up, full of energy and **ancient** secrets. Today, she would explore the hidden **cisterns** beneath the city.",
        vocabulary: []
    },
    {
        id: 'story-3',
        title: 'The Lost Key',
        genre: 'Mystery',
        level: 'B2',
        coverGradient: 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900',
        date: Date.now(),
        content: "It was a rainy Tuesday when the package arrived. No return address. Just a small, heavy box wrapped in brown paper. Detective Miller opened it carefully. Inside lay a single, rusted key.\n\nIt looked **ancient**, covered in strange symbols. He recognized one symbol—a serpent eating its tail. The Ouroboros. This key belonged to the **mansion** on the hill, a place abandoned for fifty years.\n\nMiller grabbed his coat. The **investigation** was finally beginning. He knew this case would change his career forever.",
        vocabulary: []
    },
];

const CHAT_SCENARIOS: ChatScenario[] = [
    { id: 'coffee', title: 'Barista Siparişi', description: 'Order a coffee in London.', icon: '☕', initialMessage: "Hi there! What can I get for you today?", difficulty: 'Easy', gradient: 'from-orange-400 to-orange-600' },
    { id: 'interview', title: 'İş Görüşmesi', description: 'Answer questions about yourself.', icon: '💼', initialMessage: "Welcome. Tell me a little about yourself and why you want this job.", difficulty: 'Hard', gradient: 'from-blue-600 to-blue-800' },
    { id: 'hotel', title: 'Otel Check-in', description: 'Checking into a hotel.', icon: '🛎️', initialMessage: "Good evening. Do you have a reservation with us?", difficulty: 'Medium', gradient: 'from-purple-500 to-indigo-600' },
];

export default function App() {
  // ... existing state definitions
  const [view, setView] = useState<AppView>(AppView.AUTH);
  const [words, setWords] = useState<UserWord[]>([]);
  const [stories, setStories] = useState<GeneratedStory[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [showTour, setShowTour] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStory, setActiveStory] = useState<GeneratedStory | null>(null);
  
  const [selectedWordForAdd, setSelectedWordForAdd] = useState<WordData | null>(null); 
  const [previewWord, setPreviewWord] = useState<WordData | null>(null); 
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  
  const [studioMode, setStudioMode] = useState<'hub' | 'stories' | 'roleplay' | 'chat'>('hub');
  const [activeScenario, setActiveScenario] = useState<ChatScenario | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [currentStoryPage, setCurrentStoryPage] = useState(0);
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const [readerFontSize, setReaderFontSize] = useState<'text-lg' | 'text-xl' | 'text-2xl'>('text-xl');
  const [readerFont, setReaderFont] = useState<'font-serif' | 'font-sans'>('font-serif');
  const [showReaderSettings, setShowReaderSettings] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'new' | 'learning' | 'mastered'>('all');
  const [librarySearch, setLibrarySearch] = useState('');
  const [editingWord, setEditingWord] = useState<UserWord | null>(null);
  
  const [sessionCount, setSessionCount] = useState(0); 
  const [initialSessionSize, setInitialSessionSize] = useState(0);
  const [overrideMode, setOverrideMode] = useState<StudyMode | 'auto'>('auto');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);
  const [showAutoGenNotification, setShowAutoGenNotification] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const lastAutoGenerationRef = useRef<string | null>(null);

  const storyPages = useMemo(() => {
    if (!activeStory) return [];
    const content = activeStory.content;
    const paragraphs = content.split('\n\n');
    const pages: string[] = [];
    let currentPage = '';
    paragraphs.forEach(para => {
        if ((currentPage + para).length < 600) {
             currentPage += (currentPage ? '\n\n' : '') + para;
        } else {
             if (currentPage) pages.push(currentPage);
             currentPage = para;
        }
    });
    if (currentPage) pages.push(currentPage);
    return pages.length > 0 ? pages : [content];
  }, [activeStory]);

  useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatTyping]);

  // ... existing useEffects for Auth, Leaderboard, AutoGen, Theme, LocalStorage, Focus ...
  useEffect(() => {
    let unsubscribeWords: () => void;
    let isMounted = true;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!isMounted) return;
        setLoadingAuth(true);
        if (user) {
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists() && isMounted) {
                    const rawData = userDoc.data();
                    const profileData = cleanProfile(rawData);

                    const today = new Date().toDateString();
                    const isNewDay = profileData.lastStudyDate !== today;
                    
                    const updatedProfile: UserProfile = {
                        ...profileData,
                        wordsStudiedToday: isNewDay ? 0 : (profileData.wordsStudiedToday || 0),
                        lastStudyDate: today,
                        uid: user.uid,
                        email: user.email || '',
                    };
                    
                    setUserProfile(updatedProfile);
                    if (isNewDay) saveProfile(updatedProfile);
                    
                    if (updatedProfile.hasCompletedOnboarding && !updatedProfile.hasSeenTour) {
                        setTimeout(() => setShowTour(true), 1500);
                    }

                    const wordsCollectionRef = collection(db, "users", user.uid, "words");
                    unsubscribeWords = onSnapshot(wordsCollectionRef, (snapshot) => {
                        if (!isMounted) return;
                        const loadedWords = snapshot.docs.map(doc => {
                            const data = doc.data();
                            return cleanWord({ ...data, id: doc.id });
                        });
                        loadedWords.sort((a, b) => b.dateAdded - a.dateAdded);
                        setWords(loadedWords);
                    });

                    if (!updatedProfile.hasCompletedOnboarding) {
                        setView(AppView.ONBOARDING);
                    } else {
                        setView(AppView.DASHBOARD);
                    }

                } else if (isMounted) {
                    setView(AppView.ONBOARDING);
                }
            } catch (e) {
                console.warn("Firestore fetch failed.", e);
                if(isMounted) setView(AppView.ONBOARDING);
            }
        } else {
            if(isMounted) {
                setUserProfile(null);
                setView(AppView.AUTH);
                setWords([]);
            }
        }
        
        const savedStories = localStorage.getItem(STORY_STORAGE_KEY);
        if (savedStories && isMounted) {
            try {
                setStories(JSON.parse(savedStories));
            } catch(e) {
                setStories(INITIAL_STORIES);
            }
        } else if (isMounted) {
            setStories(INITIAL_STORIES);
        }

        if(isMounted) setLoadingAuth(false);
    });

    return () => {
        isMounted = false;
        unsubscribeAuth();
        if (unsubscribeWords) unsubscribeWords();
    };
  }, []);
  
  useEffect(() => {
      if(!userProfile?.uid) return;
      const q = query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map((doc, index) => ({
              id: doc.id,
              name: doc.data().name || 'Anonymous',
              xp: doc.data().xp || 0,
              avatar: doc.data().avatar || '👤',
              rank: index + 1,
              isCurrentUser: doc.id === userProfile?.uid
          })) as LeaderboardEntry[];
          setLeaderboardData(data);
      }, (error) => {
          console.warn("Leaderboard sync error:", error);
      });
      return () => unsubscribe();
  }, [userProfile?.uid]);

  useEffect(() => {
      const checkAndGenerate = async () => {
          if (!userProfile || isGenerating) return;
          
          const today = new Date().toDateString();
          if (lastAutoGenerationRef.current === today) return;
          if (userProfile.lastGeneratedDate === today) return; 

          if (words.length > 0) {
              const hasWordsFromToday = words.some(w => new Date(w.dateAdded).toDateString() === today);
              if (hasWordsFromToday) {
                   lastAutoGenerationRef.current = today;
                   if (userProfile.lastGeneratedDate !== today) {
                       saveProfile({ ...userProfile, lastGeneratedDate: today });
                   }
                   return;
              }
          }

          const now = new Date();
          const [targetHour, targetMinute] = userProfile.studyTime.split(':').map(Number);
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          
          const isTimePassed = currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute);
          
          if (isTimePassed) {
              lastAutoGenerationRef.current = today;
              await handleGenerateDaily(true);
          }
      };
      const timer = setTimeout(checkAndGenerate, 3000);
      return () => clearTimeout(timer);
  }, [userProfile, words.length, isGenerating]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (userProfile?.theme === 'dark') {
      root.classList.add('dark');
    } else if (userProfile?.theme === 'light') {
      root.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [userProfile?.theme]);

  useEffect(() => {
    if (stories.length > 0) {
      try {
        localStorage.setItem(STORY_STORAGE_KEY, safeStringify(stories));
      } catch(e) {
          console.error("Failed to save stories", e);
      }
    }
  }, [stories]);

  useEffect(() => {
      const handleFocusIn = (e: FocusEvent) => {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
              document.body.classList.add('keyboard-open');
              setIsKeyboardOpen(true);
          }
      };
      
      const handleFocusOut = () => {
          document.body.classList.remove('keyboard-open');
          setIsKeyboardOpen(false);
      };
      
      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);
      
      return () => {
          document.removeEventListener('focusin', handleFocusIn);
          document.removeEventListener('focusout', handleFocusOut);
      };
  }, []);

  const dueWords = useMemo(() => {
    const now = Date.now();
    return words.filter(w => w.srs.nextReview <= now).sort((a, b) => a.srs.nextReview - b.srs.nextReview);
  }, [words]);
  
  const weakWords = useMemo(() => {
      return words.filter(w => w.srs.easeFactor < 2.3 && w.srs.streak > 0).sort((a, b) => a.srs.easeFactor - b.srs.easeFactor).slice(0, 10);
  }, [words]);

  useEffect(() => {
      window.speechSynthesis.cancel();
      setIsReadingAloud(false);
  }, [view, activeStory]);

  useEffect(() => {
    if (view === AppView.STUDY && initialSessionSize === 0) {
        setInitialSessionSize(Math.max(dueWords.length, weakWords.length));
        setSessionCount(0);
        setSessionResults([]);
    }
    if (view === AppView.DASHBOARD) {
        setInitialSessionSize(0);
        setSessionCount(0);
        setShowModeMenu(false);
        setOverrideMode('auto');
        setSessionResults([]);
    }
    if (view === AppView.STUDIO && studioMode === 'hub') {
        setActiveStory(null);
        setSelectedWordForAdd(null);
        setIsLookupLoading(false);
        setCurrentStoryPage(0);
    }
  }, [view, dueWords.length, weakWords.length, activeStory, studioMode]);

  // ... saveProfile, saveWordsBatch, updateWordInDb, updateDailyProgress ...
  const saveProfile = async (profile: UserProfile) => {
    const sanitizedProfile = deepSanitize(cleanProfile(profile));
    setUserProfile(sanitizedProfile);
    try {
        localStorage.setItem(PROFILE_STORAGE_KEY, safeStringify(sanitizedProfile));
    } catch(e) { console.warn("Local storage save failed", e); }
    
    if (auth.currentUser) {
        try {
            await setDoc(doc(db, "users", auth.currentUser.uid), sanitizedProfile, { merge: true });
            await setDoc(doc(db, "leaderboard", auth.currentUser.uid), {
                name: sanitizedProfile.username || 'User',
                xp: sanitizedProfile.xp || 0,
                avatar: sanitizedProfile.avatar || '🎓',
                league: sanitizedProfile.league || 'Bronze'
            }, { merge: true });
        } catch(e) { console.warn("Firestore sync failed", e); }
    }
  };

  const saveWordsBatch = async (newWords: UserWord[]) => {
      const user = auth.currentUser;
      if (!user) return;
      const batch = writeBatch(db);
      newWords.forEach(word => {
          const clean = cleanWord(word);
          const wordRef = doc(db, "users", user.uid, "words", clean.id);
          batch.set(wordRef, clean);
      });
      await batch.commit();
  };
  
  const updateWordInDb = async (word: UserWord) => {
      const user = auth.currentUser;
      if (!user) return;
      const clean = cleanWord(word);
      await setDoc(doc(db, "users", user.uid, "words", clean.id), clean, { merge: true });
  };
  
  const updateDailyProgress = (wordCount: number, xpGained: number = 0) => {
      if (!userProfile) return;
      const today = new Date().toDateString();
      const isNewDay = userProfile.lastStudyDate !== today;
      let newStreak = userProfile.streak;
      if (isNewDay) {
           const lastDate = new Date(userProfile.lastStudyDate);
           const yesterday = new Date();
           yesterday.setDate(yesterday.getDate() - 1);
           if (lastDate.toDateString() === yesterday.toDateString()) {
               newStreak += 1;
           } else {
               if ((userProfile.streakFreeze || 0) > 0) {
                   saveProfile({ ...userProfile, streakFreeze: userProfile.streakFreeze - 1 });
               } else {
                   newStreak = 1;
               }
           }
      }
      const newCount = isNewDay ? wordCount : (userProfile.wordsStudiedToday || 0) + wordCount;
      const newXp = (userProfile.xp || 0) + xpGained;
      saveProfile({ ...userProfile, wordsStudiedToday: newCount, lastStudyDate: today, xp: newXp, streak: newStreak, longestStreak: Math.max(newStreak, userProfile.longestStreak || 0) });
  };
  
  const handleAddXP = (amount: number) => { updateDailyProgress(0, amount); };

  const handleBuyFreeze = () => {
      if (!userProfile) return;
      if (userProfile.xp < 200) { alert("Yetersiz XP!"); return; }
      saveProfile({ ...userProfile, xp: userProfile.xp - 200, streakFreeze: (userProfile.streakFreeze || 0) + 1 });
  };

  const handleOnboardingComplete = async (partialProfile: UserProfile) => {
      const user = auth.currentUser;
      if (!user) return;
      const fullProfile: UserProfile = {
          ...partialProfile,
          uid: user.uid,
          email: user.email || '',
          username: userProfile?.username || 'Student',
          avatar: userProfile?.avatar || '🎓',
          hasSeenTour: false
      };
      await saveProfile(fullProfile);
      setView(AppView.DASHBOARD);
      setTimeout(() => setShowTour(true), 1000);
  };

  const handleTourComplete = () => {
      setShowTour(false);
      if (userProfile) saveProfile({ ...userProfile, hasSeenTour: true });
  };

  const updateProfile = (key: keyof UserProfile, value: any) => {
    if (userProfile) saveProfile({ ...userProfile, [key]: value });
  };

  const handleClearData = () => {
    if (confirm('Yerel veriler silinecek.')) {
        localStorage.removeItem(PROFILE_STORAGE_KEY);
        localStorage.removeItem(STORY_STORAGE_KEY);
        setWords([]);
        setStories(INITIAL_STORIES);
    }
  };

  const handleSignOut = async () => {
      await signOut(auth);
      localStorage.removeItem(PROFILE_STORAGE_KEY);
      setUserProfile(null);
      setView(AppView.AUTH);
  };

  // ... getNextIntervals, getStudyModeForWord, playWordAudio, handleGenerateDaily ...
  const getNextIntervals = (word: UserWord) => {
    const { interval } = word.srs;
    if (interval < 1) {
        return { again: '1dk', hard: '6dk', good: '10dk', easy: '1g' };
    }
    const formatDuration = (days: number) => {
      if (days < 1) return '< 1g';
      if (days < 30) return `${Math.round(days)}g`;
      return `${Math.round(days/30)}ay`;
    };
    return {
      again: '10dk', 
      hard: formatDuration(interval * 1.2),
      good: formatDuration(interval * word.srs.easeFactor),
      easy: formatDuration(interval * word.srs.easeFactor * 1.5)
    };
  };

  const getStudyModeForWord = (word: UserWord): StudyMode => {
      if (overrideMode !== 'auto') return overrideMode;
      const streak = word.srs.streak;
      const ease = word.srs.easeFactor;
      
      if (ease < 2.0) {
          if (streak > 3) return 'writing';
          return 'meaning';
      }
      
      if (streak <= 1) return 'meaning';      
      if (streak === 2) return 'translation'; 
      if (streak === 3) return 'speaking';    
      if (streak <= 5) return 'context';      
      if (streak <= 7) return 'writing';      
      
      const rand = Math.random();
      if (rand < 0.4) return 'speaking';
      if (rand < 0.7) return 'context';
      return 'writing';
  };

  const playWordAudio = async (word: UserWord | WordData) => {
      if (playingWordId) return;
      setPlayingWordId(word.id);
      try {
          if (word.audioBase64) {
              await playGeminiAudio(word.audioBase64);
          } else {
             const utterance = new SpeechSynthesisUtterance(word.term);
             window.speechSynthesis.speak(utterance);
             await new Promise(r => setTimeout(r, 1000));
          }
      } catch (e) { console.error(e); } finally { setPlayingWordId(null); }
  };

  const handleGenerateDaily = async (isAuto: boolean = false) => {
      if (!userProfile) return;
      if (isGenerating) return;
      const today = new Date().toDateString();
      if (lastAutoGenerationRef.current === today && isAuto) return;
      setIsGenerating(true);
      try {
          const targetCount = userProfile.dailyTarget || 10;
          const existingTerms = words.map(w => w.term);
          const newBatch = await generateDailyBatch(targetCount, userProfile.level, userProfile.goal, existingTerms);
          const newWords: UserWord[] = newBatch.map(w => ({
              ...w,
              dateAdded: Date.now(),
              srs: { nextReview: Date.now(), interval: 0, easeFactor: 2.5, streak: 0 }
          }));
          await saveWordsBatch(newWords);
          lastAutoGenerationRef.current = today;
          saveProfile({ ...userProfile, lastGeneratedDate: today });
          newWords.forEach(async (word) => {
              try {
                  const audio = await generateAudio(word.term);
                  if (audio) {
                      updateWordInDb({ ...word, audioBase64: audio });
                  }
              } catch(e) {}
          });
          updateDailyProgress(newWords.length, newWords.length * 10);
          if (isAuto) {
              if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification("MemoLingua", { body: `${newWords.length} yeni kelimen hazır! Çalışmaya başla.`, icon: '/icon.png' });
              }
              setShowAutoGenNotification(true);
              setTimeout(() => setShowAutoGenNotification(false), 5000);
          } else {
              setView(AppView.STUDY);
          }
      } catch (e) { 
          console.error("Generation failed", e);
          if (isAuto) { lastAutoGenerationRef.current = new Date().toDateString(); }
      } finally { 
          setIsGenerating(false); 
      }
  };

  // ... handleManualSearch, handleAddPreviewWord, handleGenerateStory, handleUpdateSRS, handleStudyResult, startScenario, handleSendMessage, handleAddWordFromStory ...
  const handleManualSearch = async () => {
      if (!searchTerm.trim() || !userProfile) return;
      setIsSearching(true);
      try {
          const newWordData = await generateSingleWord(searchTerm, userProfile.level);
          setPreviewWord(newWordData);
          setSearchTerm('');
      } catch (e) {
          console.error(e);
          alert("Kelime bulunamadı. Tekrar deneyin.");
      } finally { setIsSearching(false); }
  };
  
  const handleAddPreviewWord = async () => {
      if (!previewWord) return;
      setIsLookupLoading(true);
      try {
          const newWord: UserWord = {
              ...previewWord,
              id: crypto.randomUUID(),
              dateAdded: Date.now(),
              srs: { nextReview: Date.now(), interval: 0, easeFactor: 2.5, streak: 0 }
          };
          await saveWordsBatch([newWord]);
          
          generateAudio(newWord.term).then(audio => {
              if (audio) updateWordInDb({ ...newWord, audioBase64: audio });
          });
          
          setPreviewWord(null);
          alert(`${newWord.term} başarıyla listene eklendi!`);
      } catch (e) {
          console.error(e);
          alert("Eklenirken bir hata oluştu.");
      } finally {
          setIsLookupLoading(false);
      }
  };

  const handleGenerateStory = async () => {
    if (!userProfile) return;
    setIsGenerating(true);
    try {
        const newStoryData = await generateContextualStory(userProfile.level, userProfile.goal);
        const newStory: GeneratedStory = {
            ...newStoryData,
            id: crypto.randomUUID(),
            date: Date.now(),
            vocabulary: newStoryData.vocabulary.map(w => ({ ...w, id: crypto.randomUUID() }))
        };
        const updatedStories = [newStory, ...stories];
        setStories(updatedStories);
        setActiveStory(newStory);
        setCurrentStoryPage(0);
    } catch (e) {
        console.error(e);
        alert("Hikaye oluşturulamadı. Lütfen tekrar dene.");
    } finally { setIsGenerating(false); }
  };

  const handleUpdateSRS = async (wordId: string, newSRS: SRSState) => {
    const word = words.find(w => w.id === wordId);
    if (word) {
      await updateWordInDb({ ...word, srs: newSRS });
    }
  };

  const handleStudyResult = async (grade: 'again' | 'hard' | 'good' | 'easy') => {
      const list = dueWords.length > 0 ? dueWords : weakWords;
      if (list.length === 0) return;
      const word = list[0];
      const now = Date.now();
      let { interval, easeFactor, streak } = word.srs;
      if (grade === 'again') {
          streak = 0; interval = 0; easeFactor = Math.max(1.3, easeFactor - 0.2);
      } else if (grade === 'hard') {
          streak = 0; interval = Math.max(0.5, interval * 1.2); easeFactor = Math.max(1.3, easeFactor - 0.15);
      } else if (grade === 'good') {
          streak += 1; interval = streak === 1 ? 1 : interval * easeFactor;
      } else if (grade === 'easy') {
          streak += 1; interval = streak === 1 ? 4 : interval * easeFactor * 1.3; easeFactor += 0.15;
      }
      let nextReview = now + (interval * 24 * 60 * 60 * 1000);
      if (grade === 'again') { nextReview = now + (1 * 60 * 1000); interval = 0; }
      const newSRS = { nextReview, interval, easeFactor, streak };
      
      const historyItem: SRSHistoryItem = {
          date: now,
          grade,
          interval
      };
      
      const updatedHistory = [...(word.history || []), historyItem];
      
      await updateWordInDb({ ...word, srs: newSRS, history: updatedHistory });
      setSessionResults(prev => [...prev, { wordId: word.id, term: word.term, isCorrect: grade !== 'again', grade }]);
      setSessionCount(prev => prev + 1);
      if (grade !== 'again') {
         let xp = grade === 'easy' ? 10 : grade === 'good' ? 5 : 2;
         handleAddXP(xp);
      }
  };
  
  const startScenario = (scenario: ChatScenario) => {
      setActiveScenario(scenario);
      setStudioMode('chat');
      setChatHistory([{ id: 'init', sender: 'ai', text: scenario.initialMessage, timestamp: Date.now() }]);
      setChatInput('');
  };
  
  const handleSendMessage = async () => {
      if (!chatInput.trim() || !activeScenario) return;
      const userText = chatInput;
      setChatInput('');
      const userMsg: ChatMessage = { id: crypto.randomUUID(), sender: 'user', text: userText, timestamp: Date.now() };
      setChatHistory(prev => [...prev, userMsg]);
      setIsChatTyping(true);
      try {
          const response = await generateRoleplayResponse(activeScenario.title, [...chatHistory, userMsg], userProfile?.level || 'A1');
          const aiMsg: ChatMessage = { id: crypto.randomUUID(), sender: 'ai', text: response.text, correction: response.correction, timestamp: Date.now() };
          setChatHistory(prev => [...prev, aiMsg]);
          handleAddXP(5);
      } catch(e) { console.error(e); } finally { setIsChatTyping(false); }
  };

  const handleAddWordFromStory = async () => {
      if (!selectedWordForAdd) return;
      setIsLookupLoading(true);
      try {
           const newWord: UserWord = {
              ...selectedWordForAdd,
              id: selectedWordForAdd.id || crypto.randomUUID(),
              dateAdded: Date.now(),
              srs: { nextReview: Date.now(), interval: 0, easeFactor: 2.5, streak: 0 }
           };
           await saveWordsBatch([newWord]);
           generateAudio(newWord.term).then(audio => {
              if (audio) updateWordInDb({ ...newWord, audioBase64: audio });
           });
           setSelectedWordForAdd(null);
      } catch (e) { console.error(e); } finally { setIsLookupLoading(false); }
  };

  // ... renderWordEditor, renderPreviewModal, renderStudy, renderStudio, renderLibrary, renderDashboard, renderDiscover ...
  function renderWordEditor() {
      if (!editingWord) return null;
      return (
          <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-slide-up border border-zinc-100 dark:border-zinc-800">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-bold text-black dark:text-white">Kelime Düzenle</h3>
                      <button onClick={() => setEditingWord(null)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                          <X size={20} className="text-black dark:text-white" />
                      </button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Terim</label>
                          <input type="text" value={editingWord.term} onChange={e => setEditingWord({...editingWord, term: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl font-bold outline-none text-black dark:text-white" />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Çeviri</label>
                          <input type="text" value={editingWord.translation} onChange={e => setEditingWord({...editingWord, translation: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl outline-none text-black dark:text-white" />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Örnek Cümle</label>
                          <textarea value={editingWord.exampleSentence} onChange={e => setEditingWord({...editingWord, exampleSentence: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl outline-none h-24 resize-none text-black dark:text-white" />
                      </div>
                      <button onClick={() => { updateWordInDb(editingWord); setEditingWord(null); }} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 mt-4">
                          <Edit2 size={18} /> Kaydet
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  function renderPreviewModal() {
      if (!previewWord) return null;
      return (
          <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-slide-up border border-zinc-100 dark:border-zinc-800 relative">
                  <div className="text-center mb-6">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Kelime Bulundu</div>
                      <h2 className="text-4xl font-black text-black dark:text-white mb-2">{previewWord.term}</h2>
                      <p className="text-lg text-zinc-500 font-medium">{previewWord.translation}</p>
                      <div className="flex justify-center mt-3">
                        <button onClick={() => playWordAudio(previewWord)} className="flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-300">
                             <Volume2 size={14} /> /{previewWord.pronunciation}/
                        </button>
                      </div>
                  </div>
                  
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl mb-6">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Tanım</p>
                      <p className="text-sm text-black dark:text-white font-medium mb-3 leading-relaxed">"{previewWord.definition}"</p>
                      
                      <div className="h-px bg-zinc-200 dark:bg-zinc-700 w-full my-3 opacity-50"></div>
                      
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Örnek</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300 italic">"{previewWord.exampleSentence}"</p>
                  </div>

                  <div className="flex gap-3">
                      <button 
                        onClick={() => setPreviewWord(null)} 
                        className="flex-1 py-3.5 text-zinc-500 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                      >
                          Vazgeç
                      </button>
                      <button 
                        onClick={handleAddPreviewWord} 
                        disabled={isLookupLoading} 
                        className="flex-[2] py-3.5 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                          {isLookupLoading ? <Loader2 className="animate-spin" /> : <Plus size={18} />}
                          Listeme Ekle
                      </button>
                  </div>
              </div>
          </div>
      )
  }

  function renderStudy() {
      // ... (existing implementation)
      const sessionWords = dueWords.length > 0 ? dueWords : weakWords;
      if (sessionWords.length === 0 || sessionCount >= initialSessionSize) {
          return (
              <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in text-center">
                   <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 text-green-600 dark:text-green-400"><CheckCircle2 size={48} /></div>
                   <h2 className="text-3xl font-black mb-2 text-black dark:text-white">Oturum Tamamlandı!</h2>
                   <p className="text-zinc-500 mb-8">Tüm kelimeleri çalıştın.</p>
                   <div className="w-full max-w-sm bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-4 mb-8">
                       <div className="flex justify-between items-center mb-2"><span className="text-sm font-bold text-zinc-400 uppercase">Doğru</span><span className="font-bold text-green-500">{sessionResults.filter(r => r.isCorrect).length}</span></div>
                       <div className="flex justify-between items-center"><span className="text-sm font-bold text-zinc-400 uppercase">Yanlış</span><span className="font-bold text-red-500">{sessionResults.filter(r => !r.isCorrect).length}</span></div>
                   </div>
                   <button onClick={() => setView(AppView.DASHBOARD)} className="w-full max-w-xs py-4 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl">Ana Sayfaya Dön</button>
              </div>
          )
      }
      const currentWord = sessionWords[0];
      const mode = getStudyModeForWord(currentWord);
      return (
          <div className="flex-1 h-full flex flex-col pt-8 pb-4 overflow-hidden relative">
              <header className="px-6 mb-2 flex justify-between items-center shrink-0 z-50 relative">
                   <button onClick={() => setView(AppView.DASHBOARD)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={24} className="text-black dark:text-white" /></button>
                   <div className="flex flex-col items-center">
                       <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Oturum</span>
                       <span className="font-bold text-black dark:text-white">{sessionCount + 1} / {initialSessionSize}</span>
                   </div>
                   <button onClick={() => setShowModeMenu(!showModeMenu)} className={`p-2 rounded-full transition-colors ${showModeMenu ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}><MoreHorizontal size={24} className="text-black dark:text-white" /></button>
              </header>
  
              {/* Menu Dropdown */}
              {showModeMenu && (
                  <>
                      <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]" onClick={() => setShowModeMenu(false)}></div>
                      <div className="absolute top-20 right-6 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-2 min-w-[180px] animate-fade-in origin-top-right">
                          <p className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 mb-1">Çalışma Modu</p>
                          {[
                              { id: 'auto', label: 'Otomatik (AI)', icon: '✨' },
                              { id: 'meaning', label: 'Anlam', icon: '👀' },
                              { id: 'context', label: 'Bağlam', icon: '📝' },
                              { id: 'writing', label: 'Yazma', icon: '⌨️' },
                              { id: 'speaking', label: 'Konuşma', icon: '🎙️' },
                              { id: 'translation', label: 'Çeviri', icon: '🇹🇷' },
                          ].map(m => (
                              <button
                                  key={m.id}
                                  onClick={() => { setOverrideMode(m.id as any); setShowModeMenu(false); }}
                                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-colors ${overrideMode === m.id ? 'bg-black dark:bg-white text-white dark:text-black' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-white'}`}
                              >
                                  <span className="text-base">{m.icon}</span>
                                  {m.label}
                              </button>
                          ))}
                      </div>
                  </>
              )}
  
              <div className="flex-1 px-4 pb-4 overflow-hidden relative z-0">
                  <StudyCard 
                      key={currentWord.id + mode}
                      word={currentWord}
                      mode={mode}
                      onResult={handleStudyResult}
                      nextIntervals={getNextIntervals(currentWord)}
                      onUpdateSRS={(newSRS) => handleUpdateSRS(currentWord.id, newSRS)}
                  />
              </div>
          </div>
      );
  }

  function renderStudio() {
    // ... (existing implementation)
    if (activeStory) {
        const pages = storyPages;
        const content = pages[currentStoryPage];
        return (
             <div className="h-full flex flex-col bg-white dark:bg-zinc-950 pt-safe">
                 <header className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0 sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-10">
                     <button 
                        onClick={() => { setActiveStory(null); setStudioMode('stories'); }} 
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                     >
                        <ArrowLeft className="text-black dark:text-white" />
                     </button>
                     <div className="flex flex-col items-center">
                         <h3 className="text-sm font-bold text-black dark:text-white max-w-[200px] truncate">{activeStory.title}</h3>
                         <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{currentStoryPage + 1} / {pages.length}</span>
                     </div>
                     <div className="flex gap-2">
                         <button onClick={() => setShowReaderSettings(!showReaderSettings)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><BookOpen size={20} className="text-black dark:text-white"/></button>
                     </div>
                 </header>
                 <div className={`flex-1 overflow-y-auto p-6 ${readerFont} ${readerFontSize} leading-relaxed text-black dark:text-white`}>
                     {content.split(/(\b)/).map((part, i) => {
                         const vocab = activeStory.vocabulary.find(v => v.term.toLowerCase() === part.toLowerCase());
                         if (vocab) {
                             return <span key={i} onClick={() => setSelectedWordForAdd(vocab)} className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 cursor-pointer border-b-2 border-yellow-300 hover:bg-yellow-200 transition-colors">{part}</span>
                         }
                         return <span key={i}>{part}</span>
                     })}
                 </div>
                 <footer className="p-4 flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950">
                     <button disabled={currentStoryPage === 0} onClick={() => setCurrentStoryPage(p => p - 1)} className="text-sm font-bold text-zinc-500 disabled:opacity-30 hover:text-black dark:hover:text-white px-4 py-2">Önceki</button>
                     <div className="h-1 flex-1 mx-4 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-black dark:bg-white transition-all" style={{width: `${((currentStoryPage + 1) / pages.length) * 100}%`}}></div>
                     </div>
                     <button disabled={currentStoryPage === pages.length - 1} onClick={() => setCurrentStoryPage(p => p + 1)} className="text-sm font-bold text-zinc-500 disabled:opacity-30 hover:text-black dark:hover:text-white px-4 py-2">Sonraki</button>
                 </footer>
             </div>
        )
    }
    if (studioMode === 'chat' && activeScenario) {
        return (
            <div className="h-full flex flex-col bg-zinc-50 dark:bg-black">
                <header className={`p-4 bg-gradient-to-r ${activeScenario.gradient} text-white flex items-center gap-3 shadow-lg shrink-0 pt-8`}>
                    <button onClick={() => { setStudioMode('roleplay'); setActiveScenario(null); }}><ArrowLeft /></button>
                    <div><h3 className="font-bold">{activeScenario.title}</h3><p className="text-xs opacity-80">{activeScenario.description}</p></div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatHistory.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                             <div className={`max-w-[80%] p-4 rounded-2xl ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-zinc-800 text-black dark:text-white rounded-bl-none shadow-sm'}`}>
                                 <p>{msg.text}</p>
                                 {msg.correction && (
                                     <div className="mt-2 pt-2 border-t border-white/20 text-xs bg-black/10 -mx-4 -mb-4 p-2 rounded-b-2xl">
                                         <span className="font-bold opacity-70 block mb-0.5">İpucu:</span>
                                         {msg.correction}
                                     </div>
                                 )}
                             </div>
                        </div>
                    ))}
                    {isChatTyping && <div className="text-zinc-400 text-xs ml-4">Yazıyor...</div>}
                    <div ref={chatEndRef} />
                </div>
                <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shrink-0 sticky bottom-0">
                    <div className="flex gap-2">
                        <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Bir şeyler yaz..." className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-4 py-3 outline-none text-black dark:text-white" />
                        <button onClick={handleSendMessage} className="bg-blue-600 text-white p-3 rounded-xl"><Send size={20} /></button>
                    </div>
                </div>
            </div>
        )
    }
    if (studioMode === 'stories') {
        return (
            <div className="p-6 pb-6 h-full overflow-y-auto scrollbar-hide space-y-6">
                <header className="flex items-center gap-4 pt-8 mb-4">
                     <button onClick={() => setStudioMode('hub')} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowLeft className="text-black dark:text-white" /></button>
                     <h2 className="text-3xl font-black text-black dark:text-white">Hikayeler</h2>
                </header>
                <button onClick={handleGenerateStory} disabled={isGenerating} className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg">{isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}{isGenerating ? 'Yazılıyor...' : 'Yeni Hikaye Oluştur'}</button>
                <div className="grid grid-cols-1 gap-4 pb-20">
                    {stories.map(story => (
                        <div key={story.id} onClick={() => setActiveStory(story)} className={`p-6 rounded-[2rem] text-white cursor-pointer transition-transform hover:scale-[1.02] active:scale-95 shadow-lg ${story.coverGradient}`}>
                             <div className="flex justify-between items-start mb-4"><span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-bold uppercase">{story.genre}</span><span className="text-xs font-bold opacity-80">{new Date(story.date).toLocaleDateString()}</span></div>
                             <h3 className="text-2xl font-bold mb-2">{story.title}</h3>
                             <div className="flex items-center gap-2 text-sm font-medium opacity-90"><BookOpen size={16} /> {story.vocabulary.length} Kelime</div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }
    if (studioMode === 'roleplay') {
         return (
             <div className="p-6 pb-6 h-full overflow-y-auto scrollbar-hide space-y-6">
                <header className="flex items-center gap-4 pt-8 mb-4">
                     <button onClick={() => setStudioMode('hub')} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowLeft className="text-black dark:text-white" /></button>
                     <h2 className="text-3xl font-black text-black dark:text-white">Roleplay</h2>
                </header>
                <div className="grid grid-cols-1 gap-4 pb-20">
                    {CHAT_SCENARIOS.map(scenario => (
                        <div key={scenario.id} onClick={() => startScenario(scenario)} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-lg transition-all cursor-pointer">
                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${scenario.gradient} flex items-center justify-center text-2xl mb-4 shadow-md`}>{scenario.icon}</div>
                            <h3 className="text-xl font-bold text-black dark:text-white mb-1">{scenario.title}</h3>
                            <p className="text-zinc-500 text-sm mb-3">{scenario.description}</p>
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500`}>{scenario.difficulty}</span>
                        </div>
                    ))}
                </div>
             </div>
         )
    }
    return (
        <div className="p-6 pb-6 h-full overflow-y-auto scrollbar-hide space-y-6 animate-fade-in max-w-md mx-auto">
            <header className="pt-8 mb-6 flex items-center gap-4">
                 <button 
                    onClick={() => setView(AppView.DASHBOARD)} 
                    className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                >
                    <ArrowLeft size={24} className="text-black dark:text-white" />
                </button>
                 <div>
                    <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-1">Studio</h2>
                    <p className="text-zinc-500 font-medium">Yapay zeka ile pratik yap.</p>
                 </div>
            </header>
            <div className="grid grid-cols-1 gap-4">
                <button onClick={() => setStudioMode('stories')} className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 rounded-[2.5rem] text-white text-left relative overflow-hidden shadow-xl hover:shadow-indigo-500/30 transition-all group">
                    <BookOpen size={100} className="absolute -right-4 -bottom-4 opacity-20 group-hover:scale-110 transition-transform" />
                    <div className="relative z-10"><h3 className="text-2xl font-bold mb-1">AI Hikayeler</h3><p className="text-indigo-100 text-sm font-medium">Seviyene özel oluşturulan hikayeleri oku ve kelime çıkar.</p></div>
                </button>
                <button onClick={() => setStudioMode('roleplay')} className="bg-gradient-to-br from-pink-500 to-rose-600 p-8 rounded-[2.5rem] text-white text-left relative overflow-hidden shadow-xl hover:shadow-pink-500/30 transition-all group">
                    <MessageSquare size={100} className="absolute -right-4 -bottom-4 opacity-20 group-hover:scale-110 transition-transform" />
                    <div className="relative z-10"><h3 className="text-2xl font-bold mb-1">Canlı Roleplay</h3><p className="text-pink-100 text-sm font-medium">Gerçekçi senaryolarda AI ile konuşarak pratik yap.</p></div>
                </button>
            </div>
        </div>
    );
  }

  function renderLibrary() {
      // ... (existing implementation)
      const filteredWords = words.filter(w => {
          const matchesSearch = w.term.toLowerCase().includes(librarySearch.toLowerCase()) || w.translation.toLowerCase().includes(librarySearch.toLowerCase());
          if (libraryFilter === 'all') return matchesSearch;
          if (libraryFilter === 'new') return matchesSearch && w.srs.streak === 0;
          if (libraryFilter === 'learning') return matchesSearch && w.srs.streak > 0 && w.srs.streak < 5;
          if (libraryFilter === 'mastered') return matchesSearch && w.srs.streak >= 5;
          return false;
      });
      return (
          <div className="fixed inset-0 z-[60] bg-zinc-50 dark:bg-zinc-950 flex flex-col animate-slide-up">
              <div className="p-6 pb-2 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                  <div className="flex items-center gap-4 mb-6">
                      <button onClick={() => setShowLibrary(false)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowLeft size={24} className="text-black dark:text-white" /></button>
                      <h2 className="text-2xl font-black text-black dark:text-white">Kelimelerim</h2>
                  </div>
                  <div className="relative mb-4">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                      <input value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} placeholder="Kelime ara..." className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 pl-12 rounded-xl outline-none text-black dark:text-white" />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {(['all', 'new', 'learning', 'mastered'] as const).map(f => (
                          <button key={f} onClick={() => setLibraryFilter(f)} className={`px-4 py-2 rounded-full text-xs font-bold uppercase whitespace-nowrap transition-colors ${libraryFilter === f ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500'}`}>{f === 'all' ? 'Tümü' : f === 'new' ? 'Yeni' : f === 'learning' ? 'Öğreniliyor' : 'Ezberlendi'}</button>
                      ))}
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  {filteredWords.map(word => (
                      <div key={word.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                              <div className={`w-2 h-12 rounded-full ${word.srs.streak >= 5 ? 'bg-green-500' : word.srs.streak > 0 ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                              <div><p className="font-bold text-lg text-black dark:text-white">{word.term}</p><p className="text-zinc-500 text-sm">{word.translation}</p></div>
                          </div>
                          <div className="flex items-center gap-2">
                              <button onClick={() => playWordAudio(word)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-black dark:hover:text-white"><Volume2 size={18} /></button>
                              <button onClick={() => setEditingWord(word)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-blue-500"><Edit2 size={18} /></button>
                          </div>
                      </div>
                  ))}
                  {filteredWords.length === 0 && <div className="text-center py-10 text-zinc-400">Sonuç bulunamadı.</div>}
              </div>
          </div>
      )
  }

  function renderDashboard() {
    // ... (existing implementation)
    const hours = new Date().getHours();
    const greeting = hours < 12 ? 'Günaydın' : hours < 18 ? 'Tünaydın' : 'İyi Akşamlar';
    return (
        <div className="p-6 pb-32 space-y-6 animate-fade-in max-w-md mx-auto">
            <header className="flex justify-between items-center pt-8">
                <div className="flex items-center gap-3">
                    <button onClick={() => setView(AppView.PROFILE)} className="w-10 h-10 rounded-full bg-zinc-900 dark:bg-zinc-800 text-white dark:text-white flex items-center justify-center font-bold text-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                        {userProfile?.avatar || '🎓'}
                    </button>
                    <div><p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">{greeting}</p><div className="flex items-center gap-1.5"><span className="text-black dark:text-white font-bold text-lg leading-none">{userProfile?.username || 'Öğrenci'}</span></div></div>
                </div>
                 <div onClick={() => setView(AppView.GAMES)} className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-100 dark:border-zinc-700 shadow-sm cursor-pointer"><Trophy size={14} className="text-yellow-500 fill-yellow-500" /><span className="text-black dark:text-white font-bold text-xs">{userProfile?.xp || 0}</span></div>
            </header>

             <div id="daily-focus-card" className="bg-black dark:bg-zinc-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden border border-zinc-800">
                <div className="absolute top-0 right-0 p-6 opacity-20 pointer-events-none"><Target size={140} /></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div><h2 className="text-2xl font-bold tracking-tighter mb-1">Günlük Odak</h2><div className="flex items-center gap-2"><span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1"><Flame size={12} fill="currentColor" /> {userProfile?.streak || 0} Günlük Seri</span></div></div>
                        <div className="text-right bg-white/10 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/5"><div className="text-2xl font-bold leading-none">{userProfile?.wordsStudiedToday || 0}</div><div className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">/ {userProfile?.dailyTarget || 10} Kelime</div></div>
                    </div>
                    <div className="mb-2 flex justify-between text-[10px] font-bold uppercase text-zinc-500 tracking-wider"><span>Günlük İlerleme</span><span>{Math.round(Math.min(100, ((userProfile?.wordsStudiedToday || 0) / (userProfile?.dailyTarget || 1)) * 100))}%</span></div>
                    <div className="h-4 w-full bg-zinc-900 dark:bg-black rounded-full overflow-hidden mb-6 border border-zinc-800 relative shadow-inner"><div className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${((userProfile?.wordsStudiedToday || 0) / (userProfile?.dailyTarget || 1)) >= 1 ? 'bg-green-500' : 'bg-white'}`} style={{ width: `${Math.min(100, ((userProfile?.wordsStudiedToday || 0) / (userProfile?.dailyTarget || 1)) * 100)}%` }}></div></div>
                    {(userProfile?.longestStreak || 0) > 0 && (
                        <div className="bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                            <div className="flex justify-between items-center mb-2 text-xs"><span className="text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1"><Trophy size={10} /> En Uzun Seri</span><span className="font-bold text-white flex items-center gap-1"> {userProfile?.longestStreak || 0} Gün</span></div>
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, ((userProfile?.streak || 0) / (Math.max(userProfile?.longestStreak || 1, 1))) * 100)}%` }}></div></div>
                        </div>
                    )}
                </div>
             </div>
             
             <div className="grid grid-cols-3 gap-3">
                 <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-center"><p className="text-xs text-zinc-400 font-bold uppercase">Toplam</p><p className="text-xl font-black text-black dark:text-white">{words.length}</p></div>
                 <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-center"><p className="text-xs text-zinc-400 font-bold uppercase">Hedef</p><p className="text-xl font-black text-black dark:text-white">{userProfile?.studyTime}</p></div>
                 <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-center"><p className="text-xs text-zinc-400 font-bold uppercase">Ustalık</p><p className="text-xl font-black text-black dark:text-white">{words.length > 0 ? Math.round((words.filter(w => w.srs.streak > 4).length / words.length) * 100) : 0}%</p></div>
             </div>
            
            <AdBanner adSlot="dashboard-mid" />

            <div className="grid grid-cols-2 gap-3">
                <button 
                    id="action-review"
                    onClick={() => setView(AppView.STUDY)}
                    disabled={dueWords.length === 0 && weakWords.length === 0}
                    className={`p-5 rounded-[2rem] flex flex-col justify-between h-32 border transition-all active:scale-95 text-left relative overflow-hidden ${dueWords.length > 0 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 border-transparent' : weakWords.length > 0 ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 border-transparent' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800'}`}
                >
                    <div className="relative z-10 flex justify-between items-start w-full"><div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm"><Layers size={20} className="text-white" /></div>{dueWords.length > 0 && <span className="bg-white text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">{dueWords.length} Hazır</span>}</div>
                    <div className="relative z-10"><div className="font-bold text-xl leading-none mb-1">{dueWords.length > 0 ? 'Tekrar Et' : weakWords.length > 0 ? 'Eksik Kapat' : 'Tekrar Et'}</div><div className={`text-[10px] font-bold uppercase tracking-wider text-white/80`}>{dueWords.length > 0 ? 'Oturumu Başlat' : weakWords.length > 0 ? 'Zorları Çalış' : 'Oturumu Başlat'}</div></div>
                </button>
                <button 
                    id="action-discover"
                    onClick={() => setView(AppView.DISCOVER)}
                    className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] flex flex-col justify-between h-32 border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all active:scale-95 text-left group"
                >
                    <div className="bg-zinc-50 dark:bg-zinc-800 w-10 h-10 rounded-full flex items-center justify-center"><Search size={20} className="text-black dark:text-white" /></div>
                    <div><div className="font-bold text-xl leading-none mb-1 text-black dark:text-white">Kelime Ekle</div><div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">Yeni Kelime Keşfet</div></div>
                </button>
            </div>
            
            <div>
                 <div className="flex justify-between items-center mb-4 px-1"><h3 className="font-bold text-black dark:text-white text-lg tracking-tight">Son Kelimeler</h3><button onClick={() => setShowLibrary(true)} className="text-zinc-400 hover:text-black dark:hover:text-white text-xs font-bold uppercase flex items-center gap-1">Tümü Gör <ArrowRight size={14}/></button></div>
                <div className="space-y-3">
                     {words.slice(0, 5).map(word => (
                        <div key={word.id} className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <button onClick={() => playWordAudio(word)} className="h-10 w-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center hover:bg-black hover:text-white transition-colors"><Volume2 size={16}/></button>
                                <div><p className="font-bold text-black dark:text-white text-base leading-none mb-1">{word.term}</p><p className="text-xs text-zinc-500 font-medium">{word.translation}</p></div>
                            </div>
                        </div>
                     ))}
                     {words.length === 0 && <p className="text-center text-zinc-400 py-4 text-sm">Henüz kelime eklenmemiş.</p>}
                </div>
            </div>
        </div>
    );
  }

  function renderDiscover() {
       // ... (existing implementation)
       return (
          <div className="p-6 pb-28 space-y-6 animate-fade-in max-w-md mx-auto">
              <header className="pt-8 mb-6"><h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-2">Kelime Atölyesi</h2><p className="text-zinc-500 font-medium">Yeni kelimeler üret veya sözlükten ekle.</p></header>
               <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden border border-blue-500/50">
                  <div className="absolute -right-4 -top-4 opacity-20"><Sparkles size={120} /></div>
                  <div className="relative z-10">
                      <div className="inline-block px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg text-[10px] font-bold uppercase tracking-widest mb-4 border border-white/20">AI Destekli</div>
                      <h3 className="text-2xl font-bold mb-2">Günlük Karışım</h3>
                      <p className="text-blue-100 text-sm mb-6 max-w-[200px]">Seviyene ({userProfile?.level}) uygun, {userProfile?.dailyTarget} yeni kelimeyi otomatik oluştur.</p>
                      <button onClick={() => handleGenerateDaily(false)} disabled={isGenerating} className="w-full bg-white text-blue-600 py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">{isGenerating ? <Loader2 className="animate-spin" /> : <Zap size={18} fill="currentColor" />}{isGenerating ? 'Oluşturuluyor...' : 'Karışımı Oluştur'}</button>
                  </div>
               </div>
              <div className="relative z-20">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Akıllı Sözlük</h3>
                   <div className="flex gap-2">
                      <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} /><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Kelime arat ve ekle..." className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 pl-12 rounded-2xl outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all shadow-sm text-black dark:text-white" onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()} /></div>
                      <button onClick={handleManualSearch} disabled={isSearching} className="bg-black dark:bg-white text-white dark:text-black p-4 rounded-2xl transition-transform active:scale-95 disabled:opacity-50">{isSearching ? <Loader2 className="animate-spin" /> : <ArrowRight />}</button>
                   </div>
                   <p className="text-xs text-zinc-400 mt-2 pl-2">Aradığın kelime önce gösterilir, sonra istersen ekleyebilirsin.</p>
              </div>
              <div className="mt-8">
                  <div className="flex justify-between items-center mb-4"><h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Son Eklenenler</h3><button onClick={() => setShowLibrary(true)} className="text-xs font-bold text-blue-600 dark:text-blue-400">Tümü</button></div>
                  <div className="space-y-3">
                      {words.slice(0, 5).map((word) => (
                          <div key={word.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center shadow-sm">
                              <div><p className="font-bold text-black dark:text-white">{word.term}</p><p className="text-xs text-zinc-500">{word.translation}</p></div>
                              <button onClick={() => playWordAudio(word)} className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"><Volume2 size={14} /></button>
                          </div>
                      ))}
                      {words.length === 0 && <div className="text-center p-6 text-zinc-400 text-sm bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">Henüz kelime eklemedin.</div>}
                  </div>
              </div>
          </div>
      );
  }

  function renderProfile() {
      const achievements: Achievement[] = [
          { id: '1', title: 'İlk Adım', description: 'İlk kelimeni öğrendin', icon: '🌱', unlocked: (words.length > 0), progress: Math.min(1, words.length), maxProgress: 1 },
          { id: '2', title: 'Kelime Avcısı', description: '50 kelimeye ulaş', icon: '🏹', unlocked: (words.length >= 50), progress: Math.min(50, words.length), maxProgress: 50 },
          { id: '3', title: 'Ateşli', description: '3 günlük seri yap', icon: '🔥', unlocked: true, progress: userProfile?.streak || 0, maxProgress: 3 }, 
          { id: '4', title: 'Hikaye Anlatıcı', description: 'İlk hikayeni oluştur', icon: '📖', unlocked: (stories.length > 0), progress: stories.length, maxProgress: 1 },
      ];

      // Calculate Statistics
      const masteredCount = words.filter(w => w.srs.streak >= 5).length;
      const learningCount = words.filter(w => w.srs.streak > 0 && w.srs.streak < 5).length;
      const newCount = words.filter(w => w.srs.streak === 0).length;
      
      const totalWords = words.length;
      const masteryPercentage = totalWords > 0 ? (masteredCount / totalWords) * 100 : 0;
      const learningPercentage = totalWords > 0 ? (learningCount / totalWords) * 100 : 0;
      
      // Calculate Word Types
      const nouns = words.filter(w => w.type.toLowerCase().includes('noun')).length;
      const verbs = words.filter(w => w.type.toLowerCase().includes('verb')).length;
      const adjs = words.filter(w => w.type.toLowerCase().includes('adj')).length;
      const totalTyped = nouns + verbs + adjs || 1;

      return (
          <div className="p-6 pb-28 space-y-6 animate-fade-in max-w-md mx-auto">
              <header className="pt-8 flex justify-between items-start">
                  <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-4xl shadow-inner border border-zinc-200 dark:border-zinc-700">{userProfile?.avatar || '🎓'}</div>
                      <div>
                          <h2 className="text-3xl font-black text-black dark:text-white tracking-tighter mb-1">{userProfile?.username || 'Student'}</h2>
                          <div className="flex items-center gap-2"><span className="bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{userProfile?.level}</span><span className="text-zinc-500 font-bold text-sm">{userProfile?.goal}</span></div>
                      </div>
                  </div>
                  <button onClick={() => setView(AppView.SETTINGS)} className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-2xl text-zinc-500 hover:text-black dark:hover:text-white transition-colors"><SettingsIcon size={24} /></button>
              </header>

              {/* Progress Ring Card */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-xl flex items-center gap-6">
                 <div className="relative w-32 h-32 flex-shrink-0">
                     <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path className="text-zinc-100 dark:text-zinc-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                        <path className="text-blue-500 transition-all duration-1000 ease-out" strokeDasharray={`${learningPercentage + masteryPercentage}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                        <path className="text-green-500 transition-all duration-1000 ease-out" strokeDasharray={`${masteryPercentage}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center">
                         <span className="text-3xl font-black text-black dark:text-white">{totalWords}</span>
                         <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Kelime</span>
                     </div>
                 </div>
                 <div className="flex-1 space-y-3">
                     <div>
                         <div className="flex justify-between text-xs font-bold mb-1"><span className="text-green-600 dark:text-green-400">Ezberlendi</span><span>{masteredCount}</span></div>
                         <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{width: `${masteryPercentage}%`}}></div></div>
                     </div>
                     <div>
                         <div className="flex justify-between text-xs font-bold mb-1"><span className="text-blue-600 dark:text-blue-400">Öğreniliyor</span><span>{learningCount}</span></div>
                         <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{width: `${learningPercentage}%`}}></div></div>
                     </div>
                     <div>
                         <div className="flex justify-between text-xs font-bold mb-1"><span className="text-zinc-500">Yeni</span><span>{newCount}</span></div>
                         <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-zinc-300 dark:bg-zinc-700" style={{width: `${totalWords > 0 ? (newCount/totalWords)*100 : 0}%`}}></div></div>
                     </div>
                 </div>
              </div>

              {/* Detailed Stats */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-50 dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-2 mb-2 text-orange-500"><Flame size={20} /><span className="text-xs font-bold uppercase tracking-widest">Seri</span></div>
                      <div className="text-3xl font-black text-black dark:text-white">{userProfile?.streak} <span className="text-xs font-medium text-zinc-400">Gün</span></div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-2 mb-2 text-purple-500"><TrendingUp size={20} /><span className="text-xs font-bold uppercase tracking-widest">XP</span></div>
                      <div className="text-3xl font-black text-black dark:text-white">{userProfile?.xp}</div>
                  </div>
                  <div className="col-span-2 bg-zinc-50 dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                       <div><div className="flex items-center gap-2 mb-2 text-yellow-500"><Trophy size={20} /><span className="text-xs font-bold uppercase tracking-widest">Lig</span></div><div className="text-2xl font-black text-black dark:text-white">{userProfile?.league || 'Bronze'}</div></div>
                       <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-2xl shadow-sm">{userProfile?.league === 'Diamond' ? '💎' : userProfile?.league === 'Platinum' ? '💠' : userProfile?.league === 'Gold' ? '🏆' : userProfile?.league === 'Silver' ? '🥈' : '🥉'}</div>
                  </div>
              </div>
              
              {/* Word Distribution */}
              {totalWords > 0 && (
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                      <div className="flex items-center gap-2 mb-6"><PieChart size={20} className="text-zinc-400" /><h3 className="font-bold text-black dark:text-white">Kelime Türleri</h3></div>
                      <div className="space-y-4">
                          <div className="flex items-center gap-4">
                              <span className="text-xs font-bold w-12 text-zinc-500">İsim</span>
                              <div className="flex-1 h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{width: `${(nouns/totalTyped)*100}%`}}></div></div>
                              <span className="text-xs font-bold">{nouns}</span>
                          </div>
                           <div className="flex items-center gap-4">
                              <span className="text-xs font-bold w-12 text-zinc-500">Fiil</span>
                              <div className="flex-1 h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-rose-500" style={{width: `${(verbs/totalTyped)*100}%`}}></div></div>
                              <span className="text-xs font-bold">{verbs}</span>
                          </div>
                           <div className="flex items-center gap-4">
                              <span className="text-xs font-bold w-12 text-zinc-500">Sıfat</span>
                              <div className="flex-1 h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-cyan-500" style={{width: `${(adjs/totalTyped)*100}%`}}></div></div>
                              <span className="text-xs font-bold">{adjs}</span>
                          </div>
                      </div>
                  </div>
              )}

              <div>
                  <h3 className="font-bold text-black dark:text-white text-lg mb-4 px-1">Başarılar</h3>
                  <div className="space-y-3">
                      {achievements.map(ach => (
                          <div key={ach.id} className={`p-4 rounded-2xl border flex items-center gap-4 ${ach.unlocked ? 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 shadow-sm' : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800 opacity-60'}`}>
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${ach.unlocked ? 'bg-green-100 dark:bg-green-900/30' : 'bg-zinc-200 dark:bg-zinc-800 grayscale'}`}>{ach.icon}</div>
                              <div className="flex-1">
                                  <h4 className="font-bold text-black dark:text-white text-sm">{ach.title}</h4>
                                  <p className="text-xs text-zinc-500">{ach.description}</p>
                                  <div className="mt-2 h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${(ach.progress / ach.maxProgress) * 100}%` }}></div></div>
                              </div>
                              {ach.unlocked ? <CheckCircle2 className="text-green-500" size={20} /> : <Lock className="text-zinc-300" size={20} />}
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      );
  }

  if (loadingAuth) {
    return <div className="h-full w-full flex items-center justify-center bg-white dark:bg-black"><Loader2 className="animate-spin text-black dark:text-white" size={48} /></div>;
  }
  if (view === AppView.AUTH) return <Auth onLoginSuccess={() => {}} />;
  if (view === AppView.ONBOARDING) return <Onboarding onComplete={handleOnboardingComplete} />;

  return (
    <div className="h-[100dvh] w-full bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden select-none transition-colors duration-300 flex flex-col">
      {showTour && <Tour steps={[{ targetId: 'nav-dashboard', title: 'Ana Sayfa', description: 'İlerlemeni, günlük hedeflerini ve serini buradan takip et.', position: 'top' }, { targetId: 'action-review', title: 'Tekrar Yap', description: 'Akıllı tekrar sistemi ile kelimeleri unutmadan önce hatırla.', position: 'top' }, { targetId: 'action-discover', title: 'Kelime Ekle', description: 'Yapay zeka ile seviyene uygun yeni kelimeler keşfet.', position: 'top' }, { targetId: 'nav-studio', title: 'Studio', description: 'Hikayeler oku ve yapay zeka ile konuşarak pratik yap.', position: 'top' }, { targetId: 'nav-games', title: 'Arena', description: 'Oyunlar oyna, XP kazan ve ligde yüksel.', position: 'top' }]} onComplete={handleTourComplete} onSkip={handleTourComplete} />}
      
      <div className="flex-1 w-full overflow-hidden relative flex flex-col">
        {view === AppView.DASHBOARD && <div className="h-full w-full overflow-y-auto scrollbar-hide">{renderDashboard()}</div>}
        {view === AppView.STUDY && renderStudy()}
        {view === AppView.DISCOVER && <div className="h-full w-full overflow-y-auto scrollbar-hide">{renderDiscover()}</div>}
        {view === AppView.STUDIO && renderStudio()}
        {view === AppView.PROFILE && <div className="h-full w-full overflow-y-auto scrollbar-hide">{renderProfile()}</div>}
        {view === AppView.GAMES && <Games userProfile={userProfile} words={words} onAddXP={handleAddXP} leaderboardData={leaderboardData} />}
        {view === AppView.SETTINGS && <Settings userProfile={userProfile} words={words} onUpdateProfile={updateProfile} onBack={() => setView(AppView.PROFILE)} onClearData={handleClearData} onSignOut={handleSignOut} />}
      </div>

      {showLibrary && renderLibrary()}
      {editingWord && renderWordEditor()}
      {previewWord && renderPreviewModal()}
      
      {selectedWordForAdd && (
          <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-slide-up border border-zinc-100 dark:border-zinc-800 text-center">
                  <h3 className="text-xl font-bold mb-2 text-black dark:text-white">Kelime Bulundu!</h3>
                  <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl mb-6"><p className="text-2xl font-black mb-1 text-black dark:text-white">{selectedWordForAdd.term}</p><p className="text-zinc-500">{selectedWordForAdd.translation}</p></div>
                  <div className="flex gap-3">
                      <button onClick={() => setSelectedWordForAdd(null)} className="flex-1 py-3 text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">İptal</button>
                      <button onClick={handleAddWordFromStory} disabled={isLookupLoading} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-200 dark:shadow-none flex items-center justify-center gap-2">{isLookupLoading ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Ekle</button>
                  </div>
              </div>
          </div>
      )}
      {showAutoGenNotification && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[80] bg-black/80 dark:bg-white/90 backdrop-blur-md text-white dark:text-black px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-slide-up"><Sparkles className="text-yellow-400 dark:text-yellow-600" size={20} fill="currentColor" /><div className="flex flex-col"><span className="text-xs font-bold uppercase tracking-widest opacity-80">MemoLingua AI</span><span className="font-bold text-sm">Günlük kelimelerin hazır!</span></div></div>
      )}

      {view !== AppView.STUDIO && view !== AppView.STUDY && view !== AppView.SETTINGS && !showLibrary && !editingWord && !previewWord && !isKeyboardOpen && (
          <Navigation currentView={view} setView={setView} />
      )}
    </div>
  );
}