
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserWord, AppView, SRSState, UserProfile, StudyMode, UserLevel, UserGoal, GeneratedStory, Achievement, LeaderboardEntry, WordData, ChatMessage, ChatScenario, SRSHistoryItem, Quest } from './types';
import { generateDailyBatch, generateAudio, playGeminiAudio, generateContextualStory, generateSingleWord, generateRoleplayResponse, generatePhrasalVerbBatch } from './services/geminiService';
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

import { Sparkles, Zap, Layers, Volume2, Settings as SettingsIcon, ArrowLeft, Trophy, Target, CheckCircle2, MoreHorizontal, BookOpen, Search, ArrowRight, Flame, BrainCircuit, Play, Edit2, X, Send, MessageSquare, Loader2, Snowflake, Lock, Plus, BookMarked, PieChart, TrendingUp, Activity, Headphones, Pause, SkipForward, SkipBack, Gift, Wand2, Compass, Cpu, Palette, HeartPulse, Leaf, Briefcase, Plane, GraduationCap, Link2, Coffee, FileText } from 'lucide-react';

const PROFILE_STORAGE_KEY = 'memolingua_profile_v1';
const STORY_STORAGE_KEY = 'memolingua_stories_v1';

// Daily Quests Definition
const DAILY_QUESTS_TEMPLATE: Quest[] = [
    { id: 'q1', title: 'Kelime Çalış', icon: '📚', target: 10, progress: 0, completed: false, rewardXP: 20, type: 'study_words' },
    { id: 'q2', title: 'Oyun Oyna', icon: '🎮', target: 1, progress: 0, completed: false, rewardXP: 15, type: 'play_games' },
    { id: 'q3', title: 'Hikaye Oku', icon: '📖', target: 1, progress: 0, completed: false, rewardXP: 25, type: 'read_story' },
];

interface SessionResult {
    wordId: string;
    term: string;
    isCorrect: boolean;
    grade: string;
}

const safeStringify = (obj: any) => {
    const cache = new WeakSet();
    try {
        return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (cache.has(value)) {
                    // Duplicate reference found, discard key
                    return;
                }
                // Store value in our collection
                cache.add(value);
            }
            return value;
        });
    } catch (e) {
        // Fallback to empty object if stringify fails completely
        return "{}";
    }
};

const isPlainObject = (obj: any) => {
    return Object.prototype.toString.call(obj) === '[object Object]' &&
           (!obj.constructor || obj.constructor === Object);
};

const deepSanitize = (obj: any, seen = new WeakSet()): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj === undefined ? null : obj;
    }
    
    // Break circular references
    if (seen.has(obj)) return null;
    seen.add(obj);

    if (Array.isArray(obj)) {
        return obj.map(item => deepSanitize(item, seen));
    }
    
    // Only traverse plain objects to avoid Firestore internal classes
    if (!isPlainObject(obj)) {
        return null;
    }

    const result: any = {};
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value !== undefined) {
            result[key] = deepSanitize(value, seen);
        }
    }
    return result;
};

const cleanProfile = (data: any): UserProfile => {
    if (!data) throw new Error("Profile data is missing");
    
    // Explicitly map quests to new plain objects to strip any Firestore/internal refs
    const quests = Array.isArray(data.quests) ? data.quests.map((q: any) => ({
        id: String(q.id || ''),
        title: String(q.title || ''),
        icon: String(q.icon || '❓'),
        target: Number(q.target) || 1,
        progress: Number(q.progress) || 0,
        completed: !!q.completed,
        rewardXP: Number(q.rewardXP) || 0,
        type: String(q.type || 'study_words') as any
    })) : DAILY_QUESTS_TEMPLATE;

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
        quests: quests,
        lastQuestDate: String(data.lastQuestDate || new Date().toDateString()),
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
    
    // Explicitly map history to plain objects
    if (Array.isArray(data.history)) {
        word.history = data.history.map((h: any) => ({
             date: Number(h.date) || Date.now(),
             grade: String(h.grade || 'good') as any,
             interval: Number(h.interval) || 0
        }));
    }

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
  
  // Audio Player State
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  const [audioPlayerCurrentIndex, setAudioPlayerCurrentIndex] = useState(0);
  const [isAudioPlayerPlaying, setIsAudioPlayerPlaying] = useState(false);

  // Phrasal Verb Mode
  const [phrasalVerbMode, setPhrasalVerbMode] = useState<'informal' | 'formal'>('informal');

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
                    
                    // Reset quests if new day
                    let currentQuests = profileData.quests || DAILY_QUESTS_TEMPLATE;
                    if (profileData.lastQuestDate !== today) {
                        currentQuests = DAILY_QUESTS_TEMPLATE.map(q => ({ ...q, progress: 0, completed: false }));
                    }

                    const updatedProfile: UserProfile = {
                        ...profileData,
                        wordsStudiedToday: isNewDay ? 0 : (profileData.wordsStudiedToday || 0),
                        lastStudyDate: today,
                        lastQuestDate: today,
                        quests: currentQuests,
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
  
  // Audio Player Logic
  useEffect(() => {
    let audioTimeout: any;
    
    const playLoop = async () => {
        if (!isAudioPlayerPlaying || !showAudioPlayer || words.length === 0) return;
        
        const word = words[audioPlayerCurrentIndex];
        
        // 1. Speak Term (English)
        await playWordAudio(word);
        
        // 2. Pause
        await new Promise(r => audioTimeout = setTimeout(r, 1000));
        
        // 3. Speak Translation (Turkish - Browser TTS fallback usually better for TR)
        const trUtterance = new SpeechSynthesisUtterance(word.translation);
        trUtterance.lang = 'tr-TR';
        window.speechSynthesis.speak(trUtterance);
        
        // Wait for TR speech to end approximately or use event
        await new Promise(r => {
             trUtterance.onend = r;
             // Safety timeout in case onend doesn't fire
             setTimeout(r, 3000); 
        });

        // 4. Pause before next
        await new Promise(r => audioTimeout = setTimeout(r, 1500));
        
        if (isAudioPlayerPlaying) {
            setAudioPlayerCurrentIndex(prev => (prev + 1) % words.length);
        }
    };
    
    if (isAudioPlayerPlaying) {
        playLoop();
    }
    
    return () => {
        clearTimeout(audioTimeout);
        window.speechSynthesis.cancel();
    };
  }, [isAudioPlayerPlaying, audioPlayerCurrentIndex, showAudioPlayer]);


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
  
  // Quest Logic
  const handleQuestProgress = (type: Quest['type'], amount: number = 1) => {
      if (!userProfile) return;
      
      const updatedQuests = (userProfile.quests || DAILY_QUESTS_TEMPLATE).map(q => {
          if (q.type === type && !q.completed) {
              const newProgress = Math.min(q.target, q.progress + amount);
              const isCompleted = newProgress >= q.target;
              if (isCompleted) {
                   handleAddXP(q.rewardXP);
                   // Show mini notification?
              }
              return { ...q, progress: newProgress, completed: isCompleted };
          }
          return q;
      });
      
      saveProfile({ ...userProfile, quests: updatedQuests });
  };

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

  const handleGenerateBatchByTopic = async (topic: string) => {
      if (!userProfile || isGenerating) return;
      setIsGenerating(true);
      try {
          const targetCount = 5; // Generate 5 words for specific topics
          const existingTerms = words.map(w => w.term);
          // Use the topic as the goal
          const newBatch = await generateDailyBatch(targetCount, userProfile.level, topic as UserGoal, existingTerms);
          
          const newWords: UserWord[] = newBatch.map(w => ({
              ...w,
              dateAdded: Date.now(),
              srs: { nextReview: Date.now(), interval: 0, easeFactor: 2.5, streak: 0 }
          }));
          
          await saveWordsBatch(newWords);
          
          // Generate audio in background
          newWords.forEach(async (word) => {
              try {
                  const audio = await generateAudio(word.term);
                  if (audio) updateWordInDb({ ...word, audioBase64: audio });
              } catch(e) {}
          });
          
          handleQuestProgress('add_words', newWords.length);
          alert(`${topic} ile ilgili ${newWords.length} kelime eklendi!`);
      } catch (e) {
          console.error(e);
          alert("Kelime üretilemedi.");
      } finally {
          setIsGenerating(false);
      }
  };
  
  const handleGeneratePhrasalVerbs = async (verb: string) => {
      if (!userProfile || isGenerating) return;
      setIsGenerating(true);
      try {
          const targetCount = 5;
          const existingTerms = words.map(w => w.term);
          const newBatch = await generatePhrasalVerbBatch(targetCount, userProfile.level, verb, phrasalVerbMode, existingTerms);
          
          const newWords: UserWord[] = newBatch.map(w => ({
              ...w,
              dateAdded: Date.now(),
              srs: { nextReview: Date.now(), interval: 0, easeFactor: 2.5, streak: 0 }
          }));
          
          await saveWordsBatch(newWords);
          newWords.forEach(async (word) => {
              try {
                  const audio = await generateAudio(word.term);
                  if (audio) updateWordInDb({ ...word, audioBase64: audio });
              } catch(e) {}
          });
          handleQuestProgress('add_words', newWords.length);
          alert(`${verb} için 5 adet ${phrasalVerbMode} phrasal verb eklendi!`);
      } catch (e) {
          console.error(e);
          alert("Üretim başarısız.");
      } finally {
          setIsGenerating(false);
      }
  };

  const handleManualSearch = async () => {
      if (!searchTerm.trim() || !userProfile) return;
      setIsSearching(true);
      try {
          const newWordData = await generateSingleWord(searchTerm, userProfile.level);
          
          // DIRECT ADD WITHOUT MODAL
          const newWord: UserWord = {
              ...newWordData,
              id: crypto.randomUUID(),
              dateAdded: Date.now(),
              srs: { nextReview: Date.now(), interval: 0, easeFactor: 2.5, streak: 0 }
          };
          
          await saveWordsBatch([newWord]);
          
          generateAudio(newWord.term).then(audio => {
              if (audio) updateWordInDb({ ...newWord, audioBase64: audio });
          });
          
          handleQuestProgress('add_words'); // Update Quest
          setSearchTerm('');
          alert(`${newWord.term} başarıyla eklendi!`);
      } catch (e) {
          console.error(e);
          alert("Kelime bulunamadı. Tekrar deneyin.");
      } finally { setIsSearching(false); }
  };
  
  const handleSurpriseWord = async () => {
    if (!userProfile || isSearching) return;
    setIsSearching(true);
    try {
        const topics = ['Technology', 'Nature', 'Space', 'Emotions', 'Science', 'Art'];
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];
        const newBatch = await generateDailyBatch(1, userProfile.level, randomTopic as any, words.map(w => w.term));
        if (newBatch && newBatch.length > 0) {
            const wordData = newBatch[0];
            const newWord: UserWord = {
                ...wordData,
                id: crypto.randomUUID(),
                dateAdded: Date.now(),
                srs: { nextReview: Date.now(), interval: 0, easeFactor: 2.5, streak: 0 }
            };
            await saveWordsBatch([newWord]);
            generateAudio(newWord.term).then(audio => { if(audio) updateWordInDb({...newWord, audioBase64: audio}) });
            setPreviewWord(newWord); // Show the card for the surprise word
        }
    } catch(e) { console.error(e); alert('Sürpriz yapılamadı :('); } finally { setIsSearching(false); }
  };

  const handleAddPreviewWord = async () => {
      if (!previewWord) return;
      // Already added in manual search logic, this is just for closing or confirming in other contexts
      // If we use handleSurpriseWord, it adds it then sets preview.
      // So here we just close.
      setPreviewWord(null);
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
        handleQuestProgress('read_story'); // Update Quest
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
      
      handleQuestProgress('study_words'); // Update Quest

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
           handleQuestProgress('add_words'); // Update Quest
           setSelectedWordForAdd(null);
      } catch (e) { console.error(e); } finally { setIsLookupLoading(false); }
  };

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
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Günün Sürprizi</div>
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

                  <button 
                    onClick={() => setPreviewWord(null)} 
                    className="w-full py-3.5 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                      Harika!
                  </button>
              </div>
          </div>
      )
  }

  function renderAudioPlayer() {
      if (!showAudioPlayer) return null;
      const currentWord = words[audioPlayerCurrentIndex];
      return (
          <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fade-in">
              <div onClick={() => setShowAudioPlayer(false)} className="flex-1"></div>
              <div className="bg-white dark:bg-zinc-950 rounded-t-[2.5rem] p-8 shadow-2xl animate-slide-up border-t border-zinc-200 dark:border-zinc-800">
                  <div className="w-16 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-8"></div>
                  
                  <div className="text-center mb-10">
                      {currentWord ? (
                        <>
                             <div className="w-24 h-24 rounded-full bg-zinc-100 dark:bg-zinc-800 mx-auto mb-6 flex items-center justify-center shadow-inner">
                                <Headphones size={40} className="text-black dark:text-white" />
                             </div>
                             <h2 className="text-3xl font-black text-black dark:text-white mb-2">{currentWord.term}</h2>
                             <p className="text-lg text-zinc-500 font-medium">{currentWord.translation}</p>
                             <div className="mt-4 text-xs font-bold uppercase tracking-widest text-zinc-400 bg-zinc-100 dark:bg-zinc-900 inline-block px-3 py-1 rounded-full">
                                 {audioPlayerCurrentIndex + 1} / {words.length}
                             </div>
                        </>
                      ) : (
                          <div className="text-zinc-500">Kelime listen boş.</div>
                      )}
                  </div>

                  <div className="flex items-center justify-center gap-8 mb-8">
                       <button onClick={() => setAudioPlayerCurrentIndex(prev => Math.max(0, prev - 1))} className="p-4 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                           <SkipBack size={28} className="text-black dark:text-white" />
                       </button>
                       <button 
                            onClick={() => setIsAudioPlayerPlaying(!isAudioPlayerPlaying)}
                            className="w-20 h-20 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
                       >
                           {isAudioPlayerPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
                       </button>
                       <button onClick={() => setAudioPlayerCurrentIndex(prev => Math.min(words.length - 1, prev + 1))} className="p-4 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                           <SkipForward size={28} className="text-black dark:text-white" />
                       </button>
                  </div>
                  <button onClick={() => setShowAudioPlayer(false)} className="w-full py-4 text-zinc-400 font-bold hover:text-black dark:hover:text-white transition-colors">Kapat</button>
              </div>
          </div>
      )
  }

  function renderStudy() {
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
                                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-colors ${overrideMode === m.id ? 'bg-black dark:bg-white text-white dark:text-black' : 'hover:bg-zinc-5 dark:hover:bg-zinc-800 text-black dark:text-white'}`}
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
  
  function renderDashboard() {
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
             
             {/* Quests Widget */}
             <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                 <h3 className="text-sm font-bold text-black dark:text-white mb-3 flex items-center gap-2"><CheckCircle2 size={16} className="text-blue-500" /> Günlük Görevler</h3>
                 <div className="space-y-3">
                     {(userProfile?.quests || DAILY_QUESTS_TEMPLATE).map(quest => (
                         <div key={quest.id} className="flex items-center gap-3">
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${quest.completed ? 'bg-green-100 dark:bg-green-900/30 grayscale-0' : 'bg-zinc-100 dark:bg-zinc-800 grayscale'}`}>{quest.icon}</div>
                             <div className="flex-1">
                                 <div className="flex justify-between items-center mb-1">
                                     <span className={`text-xs font-bold ${quest.completed ? 'text-green-600 dark:text-green-400 line-through' : 'text-black dark:text-white'}`}>{quest.title}</span>
                                     <span className="text-[10px] font-bold text-zinc-400 uppercase">{quest.progress}/{quest.target}</span>
                                 </div>
                                 <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                     <div className={`h-full transition-all duration-500 ${quest.completed ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (quest.progress / quest.target) * 100)}%` }}></div>
                                 </div>
                             </div>
                             {quest.completed && <div className="text-green-500"><CheckCircle2 size={16} /></div>}
                         </div>
                     ))}
                 </div>
             </div>

            <AdBanner adSlot="dashboard-mid" />

            <div className="grid grid-cols-2 gap-3">
                <button 
                    id="action-review"
                    onClick={() => setView(AppView.STUDY)}
                    disabled={dueWords.length === 0 && weakWords.length === 0}
                    className={`p-5 rounded-[2rem] flex flex-col justify-between h-36 border transition-all active:scale-95 text-left relative overflow-hidden ${dueWords.length > 0 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 border-transparent' : weakWords.length > 0 ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 border-transparent' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800'}`}
                >
                    <div className="relative z-10 flex justify-between items-start w-full"><div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm"><Layers size={20} className="text-white" /></div>{dueWords.length > 0 && <span className="bg-white text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">{dueWords.length} Hazır</span>}</div>
                    <div className="relative z-10"><div className="font-bold text-xl leading-none mb-1">{dueWords.length > 0 ? 'Tekrar Et' : weakWords.length > 0 ? 'Eksik Kapat' : 'Tekrar Et'}</div><div className={`text-[10px] font-bold uppercase tracking-wider text-white/80`}>{dueWords.length > 0 ? 'Oturumu Başlat' : weakWords.length > 0 ? 'Zorları Çalış' : 'Oturumu Başlat'}</div></div>
                </button>
                <div className="grid grid-rows-2 gap-3 h-36">
                    <button 
                        id="action-discover"
                        onClick={() => setView(AppView.DISCOVER)}
                        className="bg-white dark:bg-zinc-900 p-4 rounded-[1.5rem] flex items-center gap-3 border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all active:scale-95 text-left"
                    >
                        <div className="bg-zinc-50 dark:bg-zinc-800 w-8 h-8 shrink-0 rounded-full flex items-center justify-center"><Search size={16} className="text-black dark:text-white" /></div>
                        <div><div className="font-bold text-sm leading-none text-black dark:text-white">Kelime Ekle</div></div>
                    </button>
                    <button 
                        onClick={() => { setShowAudioPlayer(true); setIsAudioPlayerPlaying(true); }}
                        className="bg-zinc-900 dark:bg-zinc-800 p-4 rounded-[1.5rem] flex items-center gap-3 shadow-sm transition-all active:scale-95 text-left text-white"
                    >
                        <div className="bg-white/20 w-8 h-8 shrink-0 rounded-full flex items-center justify-center"><Headphones size={16} className="text-white" /></div>
                        <div><div className="font-bold text-sm leading-none">Pasif Dinleme</div><div className="text-[9px] opacity-70 uppercase tracking-widest mt-0.5">Oto Oynat</div></div>
                    </button>
                </div>
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
      const TOPIC_CATEGORIES = [
          { id: 'Business English', label: 'İş Dünyası', icon: Briefcase, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/20' },
          { id: 'Travel Essentials', label: 'Seyahat', icon: Plane, color: 'from-orange-400 to-red-500', shadow: 'shadow-orange-500/20' },
          { id: 'Academic Words', label: 'Akademik', icon: GraduationCap, color: 'from-purple-500 to-pink-600', shadow: 'shadow-purple-500/20' },
          { id: 'Technology', label: 'Teknoloji', icon: Cpu, color: 'from-cyan-400 to-blue-500', shadow: 'shadow-cyan-500/20' },
          { id: 'Arts & Culture', label: 'Sanat', icon: Palette, color: 'from-pink-400 to-rose-500', shadow: 'shadow-pink-500/20' },
          { id: 'Health', label: 'Sağlık', icon: HeartPulse, color: 'from-red-400 to-rose-600', shadow: 'shadow-red-500/20' },
          { id: 'Nature', label: 'Doğa', icon: Leaf, color: 'from-emerald-400 to-green-600', shadow: 'shadow-emerald-500/20' },
          { id: 'Daily Conversation', label: 'Günlük', icon: MessageSquare, color: 'from-zinc-500 to-zinc-700', shadow: 'shadow-zinc-500/20' },
      ];

      const PHRASAL_VERBS_INFORMAL = [
          { verb: 'Hang', desc: 'out, up, on...', color: 'bg-orange-500' },
          { verb: 'Chill', desc: 'out...', color: 'bg-pink-500' },
          { verb: 'Show', desc: 'up, off...', color: 'bg-yellow-500' },
          { verb: 'Mess', desc: 'up, around...', color: 'bg-red-500' },
          { verb: 'Check', desc: 'out, in...', color: 'bg-green-500' },
          { verb: 'Freak', desc: 'out...', color: 'bg-purple-500' },
      ];

      const PHRASAL_VERBS_FORMAL = [
          { verb: 'Carry', desc: 'out (conduct)...', color: 'bg-blue-600' },
          { verb: 'Draw', desc: 'up (compose)...', color: 'bg-indigo-600' },
          { verb: 'Lay', desc: 'out (explain)...', color: 'bg-slate-600' },
          { verb: 'Fill', desc: 'in (inform)...', color: 'bg-cyan-600' },
          { verb: 'Account', desc: 'for (explain)...', color: 'bg-teal-600' },
          { verb: 'Call', desc: 'off (cancel)...', color: 'bg-rose-600' },
      ];

      return (
          <div className="h-full flex flex-col pt-8 animate-fade-in max-w-md mx-auto pb-28">
              <header className="px-6 mb-6">
                  <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-2">Keşfet</h2>
                  <p className="text-zinc-500 font-medium">Yeni kelimeler öğren.</p>
              </header>

              <div className="flex-1 overflow-y-auto scrollbar-hide px-6 space-y-8">
                  
                  {/* SEARCH BAR (Stickyish) */}
                  <div className="sticky top-0 z-20 py-2 bg-zinc-50/80 dark:bg-black/80 backdrop-blur-md -mx-2 px-2">
                       <div className="bg-white dark:bg-zinc-900 p-2 rounded-[2rem] shadow-lg border border-zinc-100 dark:border-zinc-800 flex items-center transition-all focus-within:ring-2 focus-within:ring-black dark:focus-within:ring-white">
                          <input 
                              type="text" 
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                              placeholder="Bir kelime ara ve ekle..."
                              className="flex-1 bg-transparent border-none outline-none p-3 pl-4 font-bold text-lg text-black dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                          />
                          <button 
                              onClick={handleManualSearch} 
                              disabled={isSearching}
                              className="bg-black dark:bg-white text-white dark:text-black w-12 h-12 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shrink-0"
                          >
                              {isSearching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                          </button>
                      </div>
                  </div>

                  {/* HERO: MAGIC GENERATOR */}
                  <div>
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">Sana Özel</h3>
                      <button 
                          onClick={() => handleGenerateDaily(false)}
                          disabled={isGenerating}
                          className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-purple-800 text-white p-6 rounded-[2.5rem] shadow-xl shadow-purple-500/20 relative overflow-hidden group active:scale-[0.98] transition-all text-left"
                      >
                           <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:rotate-12 transition-transform duration-500"><Sparkles size={100} fill="currentColor" /></div>
                           <div className="relative z-10">
                               <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 border border-white/20 shadow-inner">
                                   {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 />}
                               </div>
                               <h3 className="text-2xl font-bold mb-1">Sihirli Liste</h3>
                               <p className="text-indigo-100 text-sm font-medium opacity-90 max-w-[200px] leading-relaxed">
                                   Hedefine ({userProfile?.goal}) uygun {userProfile?.dailyTarget} kelimelik günlük paketini oluştur.
                               </p>
                           </div>
                      </button>
                  </div>

                  {/* SURPRISE ME */}
                   <div>
                      <button 
                          onClick={handleSurpriseWord}
                          disabled={isSearching}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-5 rounded-[2rem] shadow-sm flex items-center gap-4 group active:scale-[0.98] transition-all"
                      >
                           <div className="w-14 h-14 bg-yellow-400 rounded-2xl flex items-center justify-center text-yellow-900 shadow-lg shadow-yellow-500/20 group-hover:scale-110 transition-transform">
                               <Gift size={24} />
                           </div>
                           <div className="text-left flex-1">
                               <h3 className="text-lg font-bold text-black dark:text-white">Bana Sürpriz Yap</h3>
                               <p className="text-zinc-500 text-xs font-medium">Rastgele ilginç bir kelime öğren.</p>
                           </div>
                           <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors">
                               <ArrowRight size={18} />
                           </div>
                      </button>
                  </div>

                  {/* PHRASAL VERBS SECTION */}
                  <div className="bg-zinc-100 dark:bg-zinc-900/50 p-5 rounded-[2.5rem]">
                      <div className="flex justify-between items-center mb-4 px-1">
                          <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Link2 size={12} /> Phrasal Verbs</h3>
                          <div className="flex bg-white dark:bg-zinc-800 rounded-lg p-0.5 shadow-sm">
                              <button 
                                onClick={() => setPhrasalVerbMode('informal')}
                                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${phrasalVerbMode === 'informal' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                              >
                                  Günlük
                              </button>
                              <button 
                                onClick={() => setPhrasalVerbMode('formal')}
                                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${phrasalVerbMode === 'formal' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                              >
                                  Resmi
                              </button>
                          </div>
                      </div>
                      
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                          {(phrasalVerbMode === 'informal' ? PHRASAL_VERBS_INFORMAL : PHRASAL_VERBS_FORMAL).map(pv => (
                              <button
                                  key={pv.verb}
                                  onClick={() => handleGeneratePhrasalVerbs(pv.verb)}
                                  disabled={isGenerating}
                                  className="min-w-[130px] p-4 rounded-[1.5rem] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all active:scale-95 group flex flex-col items-center text-center"
                              >
                                  <div className={`w-10 h-10 rounded-xl ${pv.color} text-white flex items-center justify-center font-black text-lg mb-2 shadow-md group-hover:scale-110 transition-transform`}>
                                      {pv.verb.charAt(0)}
                                  </div>
                                  <h4 className="font-bold text-base text-black dark:text-white mb-0.5">{pv.verb}</h4>
                                  <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wide truncate max-w-full">{pv.desc}</p>
                              </button>
                          ))}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-3 text-center px-4 leading-tight">
                          {phrasalVerbMode === 'informal' ? 'Arkadaş ortamı ve günlük konuşmalar için rahat ifadeler.' : 'İş dünyası ve akademik yazılar için profesyonel fiiller.'}
                      </p>
                  </div>

                  {/* TOPIC GRID */}
                  <div>
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">Koleksiyonlar</h3>
                      <div className="grid grid-cols-2 gap-3">
                          {TOPIC_CATEGORIES.map(cat => (
                              <button 
                                  key={cat.id} 
                                  onClick={() => handleGenerateBatchByTopic(cat.id)}
                                  disabled={isGenerating}
                                  className={`relative overflow-hidden bg-white dark:bg-zinc-900 p-4 rounded-[1.8rem] text-left border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-lg transition-all active:scale-[0.98] group h-32 flex flex-col justify-between`}
                              >
                                  <div className={`absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br ${cat.color} rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity`}></div>
                                  
                                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-white shadow-md ${cat.shadow}`}>
                                      <cat.icon size={18} />
                                  </div>
                                  
                                  <div>
                                      <span className="font-bold text-black dark:text-white text-base block">{cat.label}</span>
                                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">5 Kelime</span>
                                  </div>
                              </button>
                          ))}
                      </div>
                  </div>

              </div>
          </div>
      );
  }

  function renderProfile() {
      if (!userProfile) return null;
      return (
          <div className="p-6 h-full flex flex-col pt-8 animate-fade-in max-w-md mx-auto">
              <header className="flex justify-between items-center mb-8">
                  <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter">Profil</h2>
                  <button onClick={() => setView(AppView.SETTINGS)} className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                      <SettingsIcon size={24} className="text-black dark:text-white" />
                  </button>
              </header>

              <div className="flex flex-col items-center mb-8">
                  <div className="w-28 h-28 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-6xl mb-4 shadow-lg border-4 border-white dark:border-zinc-900">
                      {userProfile.avatar}
                  </div>
                  <h3 className="text-2xl font-bold text-black dark:text-white mb-1">{userProfile.username}</h3>
                  <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold uppercase tracking-wide">
                          {userProfile.level}
                      </span>
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-bold uppercase tracking-wide">
                          {userProfile.league} Lig
                      </span>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                      <div className="flex items-center gap-2 mb-2 text-orange-500">
                          <Flame size={20} />
                          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Seri</span>
                      </div>
                      <p className="text-3xl font-black text-black dark:text-white">{userProfile.streak} <span className="text-sm font-medium text-zinc-400">Gün</span></p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                      <div className="flex items-center gap-2 mb-2 text-yellow-500">
                          <Trophy size={20} />
                          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Toplam XP</span>
                      </div>
                      <p className="text-3xl font-black text-black dark:text-white">{userProfile.xp}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                      <div className="flex items-center gap-2 mb-2 text-green-500">
                          <Target size={20} />
                          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Hedef</span>
                      </div>
                      <p className="text-3xl font-black text-black dark:text-white">{userProfile.dailyTarget}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                      <div className="flex items-center gap-2 mb-2 text-blue-500">
                          <BookOpen size={20} />
                          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Kelime</span>
                      </div>
                      <p className="text-3xl font-black text-black dark:text-white">{words.length}</p>
                  </div>
              </div>

              {/* Streak Freeze Shop */}
              <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 rounded-[2rem] text-white shadow-lg mb-6 relative overflow-hidden">
                  <Snowflake size={100} className="absolute -right-6 -bottom-6 opacity-20" />
                  <div className="relative z-10 flex justify-between items-center">
                      <div>
                          <h3 className="text-lg font-bold mb-1">Seri Dondurucu</h3>
                          <p className="text-cyan-100 text-xs font-medium max-w-[150px]">Bir gün kaçırırsan serini korur.</p>
                      </div>
                      <div className="text-right">
                           <div className="text-2xl font-black mb-1">{userProfile.streakFreeze} <span className="text-sm font-medium opacity-80">Adet</span></div>
                           <button 
                              onClick={handleBuyFreeze}
                              className="px-4 py-2 bg-white text-cyan-600 rounded-xl text-xs font-bold shadow-sm hover:bg-cyan-50 transition-colors"
                           >
                               200 XP ile Al
                           </button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  function renderLibrary() {
      const filteredWords = words.filter(w => {
          if (libraryFilter === 'new') return w.srs.interval === 0;
          if (libraryFilter === 'learning') return w.srs.interval > 0 && w.srs.interval < 21;
          if (libraryFilter === 'mastered') return w.srs.interval >= 21;
          return true;
      }).filter(w => w.term.toLowerCase().includes(librarySearch.toLowerCase()) || w.translation.toLowerCase().includes(librarySearch.toLowerCase()));

      return (
          <div className="fixed inset-0 z-[60] bg-zinc-50 dark:bg-black overflow-hidden flex flex-col animate-fade-in">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 flex gap-4 items-center">
                  <button onClick={() => setShowLibrary(false)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-black dark:text-white">
                      <ArrowLeft size={24} />
                  </button>
                  <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center px-4 py-3">
                      <Search size={18} className="text-zinc-400 mr-2" />
                      <input 
                          value={librarySearch}
                          onChange={(e) => setLibrarySearch(e.target.value)}
                          placeholder="Kelimelerinde ara..." 
                          className="bg-transparent border-none outline-none text-black dark:text-white w-full font-medium"
                      />
                  </div>
              </div>

              <div className="p-4 flex gap-2 overflow-x-auto shrink-0 scrollbar-hide bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                  {['all', 'new', 'learning', 'mastered'].map(f => (
                      <button
                          key={f}
                          onClick={() => setLibraryFilter(f as any)}
                          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${libraryFilter === f ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}
                      >
                          {f === 'all' ? 'Tümü' : f === 'new' ? 'Yeni' : f === 'learning' ? 'Öğreniliyor' : 'Öğrenildi'}
                      </button>
                  ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {filteredWords.map(word => (
                      <div key={word.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex justify-between items-center group">
                          <div>
                              <h3 className="text-lg font-bold text-black dark:text-white">{word.term}</h3>
                              <p className="text-sm text-zinc-500">{word.translation}</p>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => playWordAudio(word)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-black dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                  <Volume2 size={16} />
                              </button>
                              <button onClick={() => setEditingWord(word)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30">
                                  <Edit2 size={16} />
                              </button>
                          </div>
                      </div>
                  ))}
                  {filteredWords.length === 0 && (
                      <div className="text-center py-20 text-zinc-400">
                          <p>Kelime bulunamadı.</p>
                      </div>
                  )}
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
        {view === AppView.GAMES && <Games userProfile={userProfile} words={words} onAddXP={(xp) => { handleAddXP(xp); handleQuestProgress('play_games'); }} leaderboardData={leaderboardData} />}
        {view === AppView.SETTINGS && <Settings userProfile={userProfile} words={words} onUpdateProfile={updateProfile} onBack={() => setView(AppView.PROFILE)} onClearData={handleClearData} onSignOut={handleSignOut} />}
      </div>

      {showLibrary && renderLibrary()}
      {editingWord && renderWordEditor()}
      {previewWord && renderPreviewModal()}
      {showAudioPlayer && renderAudioPlayer()}
      
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

      {view !== AppView.STUDIO && view !== AppView.STUDY && view !== AppView.SETTINGS && !showLibrary && !editingWord && !previewWord && !isKeyboardOpen && !showAudioPlayer && (
          <Navigation currentView={view} setView={setView} />
      )}
    </div>
  );
}
