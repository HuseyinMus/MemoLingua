import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserWord, AppView, SRSState, UserProfile, StudyMode, UserLevel, UserGoal, GeneratedStory, Achievement, LeaderboardEntry, WordData, ChatMessage, ChatScenario } from './types';
import { generateDailyBatch, generateAudio, playGeminiAudio, generateContextualStory, generateSingleWord, generateRoleplayResponse } from './services/geminiService';
import { auth, db } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, writeBatch, query, orderBy, limit } from 'firebase/firestore';

import { Navigation } from './components/Navigation';
import { StudyCard } from './components/StudyCard';
import { Onboarding } from './components/Onboarding';
import { Arcade } from './components/Arcade';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { Tour, TourStep } from './components/Tour';
import { AdBanner } from './components/AdBanner';

import { Sparkles, Zap, Layers, Volume2, AlignLeft, FileText, Settings as SettingsIcon, ArrowLeft, Trophy, Target, LogOut, CheckCircle2, RotateCcw, ChevronDown, Check, Loader2, Search, ArrowRight, Flame, BrainCircuit, User, Play, Calendar, MoreHorizontal, PenTool, Mic, BookOpen, Moon, Sun, Bell, VolumeX, Shield, PieChart, Award, Trash2, Crown, Lock, Library, Edit2, X, ShoppingBag, Snowflake, Quote, TrendingUp, Grid, Clock, Book, PlusCircle, Pause, ChevronLeft, ChevronRight, Type, Move, MessageSquare, Coffee, Briefcase, MapPin, Send, MessageCircle, Save } from 'lucide-react';

const PROFILE_STORAGE_KEY = 'memolingua_profile_v1';
const STORY_STORAGE_KEY = 'memolingua_stories_v1';

interface SessionResult {
    wordId: string;
    term: string;
    isCorrect: boolean;
    grade: string;
}

const safeStringify = (obj: any) => {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) {
                return;
            }
            cache.add(value);
        }
        return value;
    });
};

const cleanProfile = (data: any): UserProfile => {
    if (!data) throw new Error("Profile data is missing");
    
    // Base object with mandatory fields
    const profile: any = {
        email: data.email || '',
        username: data.username || 'Student',
        avatar: data.avatar || '🎓',
        level: data.level || 'A1',
        goal: data.goal || 'General English',
        hasCompletedOnboarding: !!data.hasCompletedOnboarding,
        hasSeenTour: !!data.hasSeenTour,
        dailyTarget: Number(data.dailyTarget) || 10,
        studyTime: data.studyTime || '09:00',
        lastGeneratedDate: data.lastGeneratedDate || '',
        wordsStudiedToday: Number(data.wordsStudiedToday) || 0,
        lastStudyDate: data.lastStudyDate || new Date().toDateString(),
        xp: Number(data.xp) || 0,
        streakFreeze: Number(data.streakFreeze) || 0,
        streak: Number(data.streak) || 0,
        longestStreak: Number(data.longestStreak) || 0,
        league: data.league || 'Bronze',
        theme: data.theme || 'system',
        settings: {
            autoPlayAudio: data.settings?.autoPlayAudio ?? true,
            notifications: data.settings?.notifications ?? true,
            soundEffects: data.settings?.soundEffects ?? true,
        }
    };

    // Add optional fields only if they exist to prevent 'undefined' in Firestore
    if (data.uid) profile.uid = data.uid;

    return profile as UserProfile;
};

const cleanWord = (data: any): UserWord => {
    // Construct object step-by-step to avoid undefined values
    const word: any = {
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

    // Only add optional fields if they have values (Firestore crashes on undefined)
    if (data.audioBase64) word.audioBase64 = String(data.audioBase64);
    if (data.mnemonic) word.mnemonic = String(data.mnemonic);

    return word as UserWord;
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
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  
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
                    
                    if ('Notification' in window && Notification.permission === 'default') {
                        Notification.requestPermission();
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
        setSessionStartTime(Date.now());
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
    const sanitizedProfile = cleanProfile(profile);
    setUserProfile(sanitizedProfile);
    
    try {
        localStorage.setItem(PROFILE_STORAGE_KEY, safeStringify(sanitizedProfile));
    } catch(e) {}
    
    if (auth.currentUser) {
        try {
            await setDoc(doc(db, "users", auth.currentUser.uid), sanitizedProfile, { merge: true });
            await setDoc(doc(db, "leaderboard", auth.currentUser.uid), {
                name: sanitizedProfile.username || 'User',
                xp: sanitizedProfile.xp || 0,
                avatar: sanitizedProfile.avatar || '🎓',
                league: sanitizedProfile.league || 'Bronze'
            }, { merge: true });
        } catch(e) {}
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
      
      saveProfile({ 
          ...userProfile, 
          wordsStudiedToday: newCount, 
          lastStudyDate: today, 
          xp: newXp,
          streak: newStreak,
          longestStreak: Math.max(newStreak, userProfile.longestStreak || 0)
      });
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
          if (streak > 4) return 'writing';
          return 'meaning';
      }
      if (streak <= 1) return 'meaning';
      if (streak === 2) return 'translation';
      if (streak <= 4) return 'context';
      if (streak <= 6) return 'writing';
      if (Math.random() > 0.7) return 'speaking';
      return 'writing';
  };

  const playWordAudio = async (word: UserWord) => {
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
      if (lastAutoGenerationRef.current === today && isAuto) {
          return;
      }

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
          if (isAuto) {
            lastAutoGenerationRef.current = new Date().toDateString();
          }
      } finally { 
          setIsGenerating(false); 
      }
  };

  const handleManualSearch = async () => {
      if (!searchTerm.trim() || !userProfile) return;
      setIsSearching(true);
      try {
          const newWordData = await generateSingleWord(searchTerm, userProfile.level);
          const newWord: UserWord = {
              ...newWordData,
              dateAdded: Date.now(),
              srs: { nextReview: Date.now(), interval: 0, easeFactor: 2.5, streak: 0 }
          };
          
          await saveWordsBatch([newWord]);
          
          generateAudio(newWord.term).then(audio => {
              if (audio) updateWordInDb({ ...newWord, audioBase64: audio });
          });

          setSearchTerm('');
          setView(AppView.STUDY);
      } catch (e) {
          console.error(e);
          alert("Kelime bulunamadı. Tekrar deneyin.");
      } finally { setIsSearching(false); }
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
        setCurrentStoryPage(0); // Reset page to 0 when creating new story
    } catch (e) {
        console.error(e);
        alert("Hikaye oluşturulamadı. Lütfen tekrar dene.");
    } finally {
        setIsGenerating(false);
    }
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
          streak = 0;
          interval = 0; 
          easeFactor = Math.max(1.3, easeFactor - 0.2);
      } else if (grade === 'hard') {
          streak = 0; 
          interval = Math.max(0.5, interval * 1.2);
          easeFactor = Math.max(1.3, easeFactor - 0.15);
      } else if (grade === 'good') {
          streak += 1;
          interval = streak === 1 ? 1 : interval * easeFactor;
      } else if (grade === 'easy') {
          streak += 1;
          interval = streak === 1 ? 4 : interval * easeFactor * 1.3;
          easeFactor += 0.15;
      }
      
      let nextReview = now + (interval * 24 * 60 * 60 * 1000);
      
      if (grade === 'again') {
          nextReview = now + (1 * 60 * 1000);
          interval = 0;
      }

      const newSRS = { nextReview, interval, easeFactor, streak };
      await updateWordInDb({ ...word, srs: newSRS });
      
      setSessionResults(prev => [...prev, {
          wordId: word.id,
          term: word.term,
          isCorrect: grade !== 'again',
          grade
      }]);
      setSessionCount(prev => prev + 1);
      
      if (grade !== 'again') {
         let xp = grade === 'easy' ? 10 : grade === 'good' ? 5 : 2;
         handleAddXP(xp);
      }
  };
  
  const startScenario = (scenario: ChatScenario) => {
      setActiveScenario(scenario);
      setStudioMode('chat');
      setChatHistory([{
          id: 'init',
          sender: 'ai',
          text: scenario.initialMessage,
          timestamp: Date.now()
      }]);
      setChatInput('');
  };
  
  const handleSendMessage = async () => {
      if (!chatInput.trim() || !activeScenario) return;
      const userText = chatInput;
      setChatInput('');
      
      const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          sender: 'user',
          text: userText,
          timestamp: Date.now()
      };
      
      setChatHistory(prev => [...prev, userMsg]);
      setIsChatTyping(true);
      
      try {
          const response = await generateRoleplayResponse(activeScenario.title, [...chatHistory, userMsg], userProfile?.level || 'A1');
          
          const aiMsg: ChatMessage = {
              id: crypto.randomUUID(),
              sender: 'ai',
              text: response.text,
              correction: response.correction,
              timestamp: Date.now()
          };
          
          setChatHistory(prev => [...prev, aiMsg]);
          handleAddXP(5);
      } catch(e) {
          console.error(e);
      } finally {
          setIsChatTyping(false);
      }
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
      } catch (e) {
          console.error(e);
      } finally {
          setIsLookupLoading(false);
      }
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
                          <input 
                            type="text" 
                            value={editingWord.term} 
                            onChange={e => setEditingWord({...editingWord, term: e.target.value})}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl font-bold outline-none text-black dark:text-white"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Çeviri</label>
                          <input 
                            type="text" 
                            value={editingWord.translation} 
                            onChange={e => setEditingWord({...editingWord, translation: e.target.value})}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl outline-none text-black dark:text-white"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Örnek Cümle</label>
                          <textarea 
                            value={editingWord.exampleSentence} 
                            onChange={e => setEditingWord({...editingWord, exampleSentence: e.target.value})}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl outline-none h-24 resize-none text-black dark:text-white"
                          />
                      </div>
                      
                      <button 
                        onClick={() => {
                            updateWordInDb(editingWord);
                            setEditingWord(null);
                        }}
                        className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 mt-4"
                      >
                          <Save size={18} /> Kaydet
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  function renderStudio() {
      if (studioMode === 'chat' && activeScenario) {
          return (
              <div className="h-full flex flex-col bg-white dark:bg-zinc-950 animate-fade-in relative z-50">
                   <div className={`px-6 py-4 flex items-center gap-4 bg-gradient-to-r ${activeScenario.gradient} text-white shadow-md sticky top-0 z-40 shrink-0`}>
                       <button onClick={() => setStudioMode('roleplay')} className="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors">
                           <ArrowLeft size={24} />
                       </button>
                       <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-xl">
                           {activeScenario.icon}
                       </div>
                       <div>
                           <h3 className="font-bold text-lg leading-none">{activeScenario.title}</h3>
                           <p className="text-xs text-white/80 font-medium">AI Roleplay</p>
                       </div>
                   </div>

                   <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 bg-zinc-50 dark:bg-zinc-900 scrollbar-hide">
                       {chatHistory.map(msg => (
                           <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                               <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-zinc-800 text-black dark:text-white rounded-tl-none border border-zinc-100 dark:border-zinc-700'}`}>
                                   {msg.text}
                               </div>
                               
                               {msg.correction && (
                                   <div className="mt-2 max-w-[80%] bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 p-3 rounded-xl flex items-start gap-2 animate-fade-in">
                                       <BrainCircuit size={14} className="text-orange-500 shrink-0 mt-0.5" />
                                       <div className="text-xs text-orange-700 dark:text-orange-300">
                                           <span className="font-bold block mb-0.5">Suggestion:</span>
                                           {msg.correction}
                                       </div>
                                   </div>
                               )}
                           </div>
                       ))}
                       {isChatTyping && (
                           <div className="flex items-start">
                               <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl rounded-tl-none border border-zinc-100 dark:border-zinc-700 flex gap-1">
                                   <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"></span>
                                   <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-100"></span>
                                   <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-200"></span>
                               </div>
                           </div>
                       )}
                       <div ref={chatEndRef} />
                   </div>

                   <div className="p-4 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 sticky bottom-0 z-50">
                       <form 
                           onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                           className="flex gap-2 items-center"
                       >
                           <input 
                               type="text" 
                               value={chatInput}
                               onChange={(e) => setChatInput(e.target.value)}
                               placeholder="Type a message..."
                               className="flex-1 bg-zinc-100 dark:bg-zinc-900 border-0 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                           />
                           <button 
                               type="submit" 
                               disabled={!chatInput.trim() || isChatTyping}
                               className="p-3 bg-blue-600 text-white rounded-full shadow-lg disabled:opacity-50 active:scale-95 transition-transform"
                           >
                               <Send size={20} />
                           </button>
                       </form>
                   </div>
              </div>
          );
      }
      
      if (studioMode === 'roleplay') {
          return (
              <div className="h-full w-full overflow-y-auto p-6 pb-6 space-y-6 animate-fade-in max-w-md mx-auto scrollbar-hide">
                  <header className="pt-8 mb-4 flex items-center gap-4">
                      <button onClick={() => setStudioMode('hub')} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-black dark:text-white transition-colors">
                          <ArrowLeft size={24} />
                      </button>
                      <h2 className="text-3xl font-black text-black dark:text-white tracking-tighter">AI Roleplay</h2>
                  </header>
                  <div className="grid grid-cols-1 gap-4">
                      {CHAT_SCENARIOS.map(scenario => (
                          <button 
                              key={scenario.id}
                              onClick={() => startScenario(scenario)}
                              className={`relative overflow-hidden p-6 rounded-[2rem] text-left shadow-lg hover:scale-[1.02] active:scale-95 transition-all group bg-gradient-to-br ${scenario.gradient}`}
                          >
                              <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-30 transition-opacity">
                                  <MessageCircle size={80} />
                              </div>
                              <div className="relative z-10 text-white">
                                  <div className="flex justify-between items-start mb-4">
                                      <span className="text-4xl">{scenario.icon}</span>
                                      <span className="bg-black/20 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-white/20">
                                          {scenario.difficulty}
                                      </span>
                                  </div>
                                  <h3 className="text-2xl font-bold mb-1">{scenario.title}</h3>
                                  <p className="text-white/80 text-sm font-medium opacity-90">{scenario.description}</p>
                              </div>
                          </button>
                      ))}
                  </div>
              </div>
          );
      }

      if (studioMode === 'stories') {
          if (activeStory) {
              const pages = storyPages; 
               return (
                   <div className="h-full flex flex-col bg-white dark:bg-zinc-950 animate-fade-in relative z-50">
                       <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 shrink-0">
                           <button onClick={() => setActiveStory(null)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                               <ArrowLeft size={24} className="text-black dark:text-white" />
                           </button>
                           <button onClick={() => setShowReaderSettings(!showReaderSettings)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                               <Type size={20} className="text-black dark:text-white" />
                           </button>
                       </div>
                       
                       {showReaderSettings && (
                            <div className="absolute top-16 right-6 z-50 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-800 p-4 animate-slide-up w-64">
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Font Size</p>
                                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 mb-4">
                                    {(['text-lg', 'text-xl', 'text-2xl'] as const).map(s => (
                                        <button key={s} onClick={() => setReaderFontSize(s)} className={`flex-1 py-1 rounded-md text-xs font-bold ${readerFontSize === s ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-500'}`}>
                                            {s === 'text-lg' ? 'A' : s === 'text-xl' ? 'A+' : 'A++'}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Font Style</p>
                                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                                    {(['font-serif', 'font-sans'] as const).map(f => (
                                        <button key={f} onClick={() => setReaderFont(f)} className={`flex-1 py-1 rounded-md text-xs font-bold ${readerFont === f ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-500'}`}>
                                            {f === 'font-serif' ? 'Serif' : 'Sans'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                       )}

                       <div className={`flex-1 overflow-y-auto p-6 md:p-10 max-w-xl mx-auto w-full flex flex-col prose dark:prose-invert ${readerFontSize} leading-loose ${readerFont} text-zinc-800 dark:text-zinc-300`}>
                            <p className="animate-fade-in min-h-[50vh] whitespace-pre-line">
                                {pages[currentStoryPage].split(' ').map((word, i) => (
                                    <span 
                                        key={i} 
                                        onClick={() => {
                                            const clean = word.replace(/[^a-zA-Z]/g, "");
                                            if (clean) {
                                                setIsLookupLoading(true);
                                                generateSingleWord(clean, userProfile?.level || 'A1')
                                                    .then(data => {
                                                        const existing = words.find(w => w.term.toLowerCase() === clean.toLowerCase());
                                                        // If it exists in library, use that ID to show "Saved" status
                                                        if (existing) {
                                                            setSelectedWordForAdd({ ...data, id: existing.id }); 
                                                        } else {
                                                            setSelectedWordForAdd(data);
                                                        }
                                                        setIsLookupLoading(false);
                                                    })
                                                    .catch(() => setIsLookupLoading(false));
                                            }
                                        }}
                                        className="cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-900/50 rounded px-0.5 transition-colors"
                                    >
                                        {word}{' '}
                                    </span>
                                ))}
                            </p>
                       </div>
                       
                       <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md flex justify-between items-center max-w-xl mx-auto w-full shrink-0">
                           <button onClick={() => setCurrentStoryPage(p => Math.max(0, p-1))} disabled={currentStoryPage===0} className="p-4 disabled:opacity-30"><ChevronLeft className="text-black dark:text-white"/></button>
                           <span className="font-bold text-sm text-zinc-500">{currentStoryPage + 1} / {pages.length}</span>
                           <button onClick={() => setCurrentStoryPage(p => Math.min(pages.length-1, p+1))} disabled={currentStoryPage===pages.length-1} className="p-4 disabled:opacity-30"><ChevronRight className="text-black dark:text-white"/></button>
                       </div>
                   </div>
               );
          } else {
             return (
                 <div className="h-full w-full overflow-y-auto p-6 pb-6 space-y-6 animate-fade-in max-w-md mx-auto scrollbar-hide">
                      <header className="pt-8 mb-4 flex items-center gap-4">
                          <button onClick={() => setStudioMode('hub')} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-black dark:text-white transition-colors">
                              <ArrowLeft size={24} />
                          </button>
                          <h2 className="text-3xl font-black text-black dark:text-white tracking-tighter">Hikayeler</h2>
                      </header>
                      
                      <button 
                          onClick={handleGenerateStory}
                          disabled={isGenerating}
                          className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-[2rem] font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 mb-6"
                      >
                          {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
                          {isGenerating ? 'Hikaye Yazılıyor...' : 'Yeni Hikaye Oluştur'}
                      </button>

                      <div className="space-y-4">
                          {stories.map(story => (
                              <button 
                                  key={story.id}
                                  onClick={() => {
                                      setActiveStory(story);
                                      setCurrentStoryPage(0);
                                  }}
                                  className={`w-full text-left p-6 rounded-[2.5rem] relative overflow-hidden group hover:scale-[1.02] active:scale-95 transition-all shadow-lg ${story.coverGradient}`}
                              >
                                  <div className="relative z-10 text-white">
                                      <h3 className="text-2xl font-bold leading-tight mb-1">{story.title}</h3>
                                      <p className="text-sm opacity-90 line-clamp-2">{story.genre}</p>
                                  </div>
                              </button>
                          ))}
                      </div>
                 </div>
             );
          }
      }

      // Default Studio Hub View
      return (
          <div className="h-full w-full overflow-y-auto p-6 pb-6 space-y-6 animate-fade-in max-w-md mx-auto scrollbar-hide">
              <header className="pt-8 mb-6 flex items-center gap-4">
                   <button onClick={() => setView(AppView.DASHBOARD)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-black dark:text-white transition-colors">
                      <ArrowLeft size={24} />
                  </button>
                  <div>
                      <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-2">Studio</h2>
                      <p className="text-zinc-500 font-medium">Practice English in real context.</p>
                  </div>
              </header>

              <div className="grid grid-cols-1 gap-4">
                  <button 
                      onClick={() => setStudioMode('stories')}
                      className="bg-zinc-900 dark:bg-white p-6 rounded-[2.5rem] text-left relative overflow-hidden group hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                  >
                      <div className="absolute top-0 right-0 p-6 opacity-10 text-white dark:text-black">
                          <Book size={120} />
                      </div>
                      <div className="relative z-10">
                          <h3 className="text-2xl font-bold text-white dark:text-black mb-1">Interactive Stories</h3>
                          <p className="text-zinc-400 dark:text-zinc-600 text-sm font-medium">Read AI-generated stories tailored to your level.</p>
                      </div>
                  </button>

                  <button 
                      onClick={() => setStudioMode('roleplay')}
                      className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2.5rem] text-left relative overflow-hidden group hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-500/20"
                  >
                      <div className="relative z-10">
                          <h3 className="text-2xl font-bold text-white mb-1">AI Roleplay</h3>
                          <p className="text-blue-100 text-sm font-medium">Chat with AI in real-life scenarios.</p>
                      </div>
                  </button>
              </div>
          </div>
    );
  }
  
  function renderStudy() {
      // 1. All Caught Up / Session Complete View
      if (dueWords.length === 0 && weakWords.length === 0) {
          return (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in max-w-md mx-auto">
                  <div className="w-32 h-32 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 animate-bounce">
                      <CheckCircle2 size={64} className="text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-3xl font-black text-black dark:text-white mb-2">Hepsini Tamamladın!</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mb-8">Şu an tekrar etmen gereken kelime kalmadı. Harika gidiyorsun.</p>
                  
                  {sessionResults.length > 0 && (
                      <div className="w-full bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 mb-8 border border-zinc-100 dark:border-zinc-800">
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Oturum Özeti</p>
                          <div className="grid grid-cols-3 gap-4">
                              <div>
                                  <div className="text-2xl font-black text-black dark:text-white">{sessionResults.length}</div>
                                  <div className="text-[10px] text-zinc-500 uppercase font-bold">Kelime</div>
                              </div>
                              <div>
                                  <div className="text-2xl font-black text-green-500">{sessionResults.filter(r => r.isCorrect).length}</div>
                                  <div className="text-[10px] text-zinc-500 uppercase font-bold">Doğru</div>
                              </div>
                              <div>
                                  <div className="text-2xl font-black text-blue-500">+{Math.floor(sessionResults.filter(r => r.isCorrect).length * 5)}</div>
                                  <div className="text-[10px] text-zinc-500 uppercase font-bold">XP</div>
                              </div>
                          </div>
                      </div>
                  )}

                  <button 
                      onClick={() => setView(AppView.DASHBOARD)}
                      className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
                  >
                      Ana Sayfaya Dön
                  </button>
              </div>
          );
      }

      // 2. Active Study Session
      const currentWord = dueWords.length > 0 ? dueWords[0] : weakWords[0];
      if (!currentWord) return null; // Fallback

      const progress = initialSessionSize > 0 ? Math.min(100, (sessionCount / initialSessionSize) * 100) : 0;
      const mode = getStudyModeForWord(currentWord);

      return (
          <div className="h-full flex flex-col p-6 animate-fade-in max-w-md mx-auto relative pb-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6 shrink-0 z-20 relative">
                  <button onClick={() => setView(AppView.DASHBOARD)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-black dark:text-white transition-colors">
                      <X size={24} />
                  </button>
                  
                  <div className="flex-1 mx-4">
                      <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-black dark:bg-white transition-all duration-500" style={{ width: `${progress}%` }}></div>
                      </div>
                  </div>

                  <div className="relative">
                      <button 
                        onClick={() => setShowModeMenu(!showModeMenu)}
                        className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-black dark:text-white transition-colors"
                      >
                          <SettingsIcon size={20} />
                      </button>
                      
                      {showModeMenu && (
                          <div className="absolute top-full right-0 mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-100 dark:border-zinc-800 p-2 min-w-[150px] z-50 animate-slide-up">
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2 py-1 mb-1">Study Mode</p>
                              {(['auto', 'meaning', 'writing', 'speaking', 'context'] as const).map(m => (
                                  <button
                                      key={m}
                                      onClick={() => { setOverrideMode(m); setShowModeMenu(false); }}
                                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold capitalize ${overrideMode === m ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                                  >
                                      {m}
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
              </div>

              {/* Study Card */}
              <div className="flex-1 min-h-0 z-10">
                  <StudyCard 
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
  
  function renderLibrary() {
    const filteredWords = words.filter(w => {
        if (librarySearch) {
            const termMatch = w.term.toLowerCase().includes(librarySearch.toLowerCase());
            const transMatch = w.translation.toLowerCase().includes(librarySearch.toLowerCase());
            if (!termMatch && !transMatch) return false;
        }

        if (libraryFilter === 'new') return w.srs.streak === 0;
        if (libraryFilter === 'learning') return w.srs.streak > 0 && w.srs.streak <= 4;
        if (libraryFilter === 'mastered') return w.srs.streak > 4;
        return true;
    });

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6 animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl h-[90vh] md:h-[85vh] rounded-t-[2.5rem] md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl animate-slide-up">
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col gap-4 bg-white dark:bg-zinc-900 z-10">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-black dark:text-white">Kütüphanem</h2>
                        <button onClick={() => setShowLibrary(false)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                            <X size={20} className="text-black dark:text-white" />
                        </button>
                    </div>
                    
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Kelime veya çeviri ara..." 
                            value={librarySearch}
                            onChange={(e) => setLibrarySearch(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 pl-10 pr-4 py-3 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-black dark:text-white"
                        />
                    </div>
                </div>

                 <div className="px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                      <button onClick={() => setLibraryFilter('all')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${libraryFilter === 'all' ? 'bg-black text-white dark:bg-white dark:text-black shadow-md scale-105' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>Tümü ({words.length})</button>
                      <button onClick={() => setLibraryFilter('new')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${libraryFilter === 'new' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>Yeni</button>
                      <button onClick={() => setLibraryFilter('learning')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${libraryFilter === 'learning' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>Öğreniliyor</button>
                      <button onClick={() => setLibraryFilter('mastered')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${libraryFilter === 'mastered' ? 'bg-green-600 text-white shadow-md shadow-green-500/30 scale-105' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>Ezberlendi</button>
                  </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/50 dark:bg-black/20">
                     {filteredWords.map(word => (
                          <div key={word.id} className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-5 rounded-2xl flex justify-between items-center group shadow-sm hover:shadow-md transition-shadow">
                              <div>
                                  <h4 className="font-bold text-lg text-black dark:text-white mb-1">{word.term}</h4>
                                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{word.translation}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                  <button onClick={() => setEditingWord(word)} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                                      <Edit2 size={18} />
                                  </button>
                                  <div className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                      word.srs.streak > 4 
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                        : word.srs.streak === 0
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                  }`}>
                                      {word.srs.streak > 4 ? 'Usta' : word.srs.streak === 0 ? 'Yeni' : 'Sev ' + word.srs.streak}
                                  </div>
                              </div>
                          </div>
                      ))}
                      {filteredWords.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-12 text-zinc-400 text-sm">
                              <Search size={48} className="mb-4 opacity-20" />
                              <p>Bu filtrede kelime bulunamadı.</p>
                          </div>
                      )}
                </div>
            </div>
        </div>
    );
  }

  function renderDashboard() {
    const hours = new Date().getHours();
    const greeting = hours < 12 ? 'Günaydın' : hours < 18 ? 'Tünaydın' : 'İyi Akşamlar';
    return (
        <div className="p-6 pb-28 space-y-6 animate-fade-in max-w-md mx-auto">
            <header className="flex justify-between items-center pt-8">
                <div className="flex items-center gap-3">
                    <button onClick={() => setView(AppView.PROFILE)} className="w-10 h-10 rounded-full bg-zinc-900 dark:bg-zinc-800 text-white dark:text-white flex items-center justify-center font-bold text-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                        {userProfile?.avatar || '🎓'}
                    </button>
                    <div>
                         <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">{greeting}</p>
                         <div className="flex items-center gap-1.5">
                             <span className="text-black dark:text-white font-bold text-lg leading-none">{userProfile?.username || 'Öğrenci'}</span>
                         </div>
                    </div>
                </div>
                 <div onClick={() => setView(AppView.ARENA)} className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-100 dark:border-zinc-700 shadow-sm cursor-pointer">
                     <Trophy size={14} className="text-yellow-500 fill-yellow-500" />
                     <span className="text-black dark:text-white font-bold text-xs">{userProfile?.xp || 0}</span>
                </div>
            </header>

             <div id="daily-focus-card" className="bg-black dark:bg-zinc-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden border border-zinc-800">
                <div className="absolute top-0 right-0 p-6 opacity-20 pointer-events-none"><Target size={140} /></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tighter mb-1">Günlük Odak</h2>
                            <div className="flex items-center gap-2">
                                <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1">
                                    <Flame size={12} fill="currentColor" /> {userProfile?.streak || 0} Günlük Seri
                                </span>
                            </div>
                        </div>
                        <div className="text-right bg-white/10 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/5">
                            <div className="text-2xl font-bold leading-none">{userProfile?.wordsStudiedToday || 0}</div>
                            <div className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">/ {userProfile?.dailyTarget || 10} Kelime</div>
                        </div>
                    </div>
                    
                    <div className="mb-2 flex justify-between text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                        <span>Günlük İlerleme</span>
                        <span>{Math.round(Math.min(100, ((userProfile?.wordsStudiedToday || 0) / (userProfile?.dailyTarget || 1)) * 100))}%</span>
                    </div>
                    <div className="h-4 w-full bg-zinc-900 dark:bg-black rounded-full overflow-hidden mb-6 border border-zinc-800 relative shadow-inner">
                        <div className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${((userProfile?.wordsStudiedToday || 0) / (userProfile?.dailyTarget || 1)) >= 1 ? 'bg-green-500' : 'bg-white'}`} style={{ width: `${Math.min(100, ((userProfile?.wordsStudiedToday || 0) / (userProfile?.dailyTarget || 1)) * 100)}%` }}></div>
                    </div>

                    {(userProfile?.longestStreak || 0) > 0 && (
                        <div className="bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                            <div className="flex justify-between items-center mb-2 text-xs">
                                 <span className="text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <Trophy size={10} /> En Uzun Seri
                                 </span>
                                 <span className="font-bold text-white flex items-center gap-1"> {userProfile?.longestStreak || 0} Gün</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                 <div 
                                    className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-1000 ease-out" 
                                    style={{ width: `${Math.min(100, ((userProfile?.streak || 0) / (Math.max(userProfile?.longestStreak || 1, 1))) * 100)}%` }}
                                 ></div>
                            </div>
                        </div>
                    )}
                </div>
             </div>
             
             <div className="grid grid-cols-3 gap-3">
                 <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-center">
                     <p className="text-xs text-zinc-400 font-bold uppercase">Toplam</p>
                     <p className="text-xl font-black text-black dark:text-white">{words.length}</p>
                 </div>
                 <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-center">
                     <p className="text-xs text-zinc-400 font-bold uppercase">Hedef</p>
                     <p className="text-xl font-black text-black dark:text-white">{userProfile?.studyTime}</p>
                 </div>
                 <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-center">
                     <p className="text-xs text-zinc-400 font-bold uppercase">Ustalık</p>
                     <p className="text-xl font-black text-black dark:text-white">
                        {words.length > 0 ? Math.round((words.filter(w => w.srs.streak > 4).length / words.length) * 100) : 0}%
                     </p>
                 </div>
             </div>
            
            <AdBanner adSlot="dashboard-mid" />

            <div className="grid grid-cols-2 gap-3">
                <button 
                    id="action-review"
                    onClick={() => setView(AppView.STUDY)}
                    disabled={dueWords.length === 0 && weakWords.length === 0}
                    className={`p-5 rounded-[2rem] flex flex-col justify-between h-32 border transition-all active:scale-95 text-left relative overflow-hidden ${
                        dueWords.length > 0 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 border-transparent' 
                            : weakWords.length > 0 
                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 border-transparent'
                                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800'
                    }`}
                >
                    <div className="relative z-10 flex justify-between items-start w-full">
                        <div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm"><Layers size={20} className="text-white" /></div>
                        {dueWords.length > 0 && <span className="bg-white text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">{dueWords.length} Hazır</span>}
                    </div>
                    <div className="relative z-10">
                        <div className="font-bold text-xl leading-none mb-1">
                            {dueWords.length > 0 ? 'Tekrar Et' : weakWords.length > 0 ? 'Eksik Kapat' : 'Tekrar Et'}
                        </div>
                        <div className={`text-[10px] font-bold uppercase tracking-wider text-white/80`}>
                             {dueWords.length > 0 ? 'Oturumu Başlat' : weakWords.length > 0 ? 'Zorları Çalış' : 'Oturumu Başlat'}
                        </div>
                    </div>
                </button>

                <button 
                    id="action-discover"
                    onClick={() => setView(AppView.DISCOVER)}
                    className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] flex flex-col justify-between h-32 border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all active:scale-95 text-left group"
                >
                    <div className="bg-zinc-50 dark:bg-zinc-800 w-10 h-10 rounded-full flex items-center justify-center"><Search size={20} className="text-black dark:text-white" /></div>
                    <div>
                        <div className="font-bold text-xl leading-none mb-1 text-black dark:text-white">Kelime Ekle</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">Yeni Kelime Keşfet</div>
                    </div>
                </button>
            </div>
            
            <div>
                 <div className="flex justify-between items-center mb-4 px-1">
                    <h3 className="font-bold text-black dark:text-white text-lg tracking-tight">Son Kelimeler</h3>
                    <button onClick={() => setShowLibrary(true)} className="text-zinc-400 hover:text-black dark:hover:text-white text-xs font-bold uppercase flex items-center gap-1">Tümü Gör <ArrowRight size={14}/></button>
                </div>
                <div className="space-y-3">
                     {words.slice(0, 5).map(word => (
                        <div key={word.id} className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <button onClick={() => playWordAudio(word)} className="h-10 w-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center hover:bg-black hover:text-white transition-colors"><Volume2 size={16}/></button>
                                <div>
                                    <p className="font-bold text-black dark:text-white text-base leading-none mb-1">{word.term}</p>
                                    <p className="text-xs text-zinc-500 font-medium">{word.translation}</p>
                                </div>
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
      return (
          <div className="p-6 pb-28 space-y-6 animate-fade-in max-w-md mx-auto">
              <header className="pt-8 mb-6">
                  <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-2">Kelime Atölyesi</h2>
                  <p className="text-zinc-500 font-medium">Yeni kelimeler üret veya sözlükten ekle.</p>
              </header>

               <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden border border-blue-500/50">
                  <div className="absolute -right-4 -top-4 opacity-20"><Sparkles size={120} /></div>
                  <div className="relative z-10">
                      <div className="inline-block px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg text-[10px] font-bold uppercase tracking-widest mb-4 border border-white/20">
                          AI Destekli
                      </div>
                      <h3 className="text-2xl font-bold mb-2">Günlük Karışım</h3>
                      <p className="text-blue-100 text-sm mb-6 max-w-[200px]">
                          Seviyene ({userProfile?.level}) uygun, {userProfile?.dailyTarget} yeni kelimeyi otomatik oluştur.
                      </p>
                      
                      <button 
                          onClick={() => handleGenerateDaily(false)}
                          disabled={isGenerating}
                          className="w-full bg-white text-blue-600 py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                          {isGenerating ? <Loader2 className="animate-spin" /> : <Zap size={18} fill="currentColor" />}
                          {isGenerating ? 'Oluşturuluyor...' : 'Karışımı Oluştur'}
                      </button>
                  </div>
               </div>

              <div className="relative z-20">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Akıllı Sözlük</h3>
                   <div className="flex gap-2">
                      <div className="relative flex-1">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                         <input 
                             type="text" 
                             value={searchTerm}
                             onChange={(e) => setSearchTerm(e.target.value)}
                             placeholder="Kelime arat ve ekle..."
                             className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 pl-12 rounded-2xl outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all shadow-sm text-black dark:text-white"
                             onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                         />
                      </div>
                      <button 
                         onClick={handleManualSearch}
                         disabled={isSearching}
                         className="bg-black dark:bg-white text-white dark:text-black p-4 rounded-2xl transition-transform active:scale-95 disabled:opacity-50"
                      >
                         {isSearching ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                      </button>
                   </div>
                   <p className="text-xs text-zinc-400 mt-2 pl-2">Aradığın kelime için otomatik olarak çeviri, tanım ve telaffuz oluşturulur.</p>
              </div>

              <div className="mt-8">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Son Eklenenler</h3>
                      <button onClick={() => setShowLibrary(true)} className="text-xs font-bold text-blue-600 dark:text-blue-400">Tümü</button>
                  </div>
                  
                  <div className="space-y-3">
                      {words.slice(0, 5).map((word) => (
                          <div key={word.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center shadow-sm">
                              <div>
                                  <p className="font-bold text-black dark:text-white">{word.term}</p>
                                  <p className="text-xs text-zinc-500">{word.translation}</p>
                              </div>
                              <button 
                                  onClick={() => playWordAudio(word)}
                                  className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                              >
                                  <Volume2 size={14} />
                              </button>
                          </div>
                      ))}
                      {words.length === 0 && (
                          <div className="text-center p-6 text-zinc-400 text-sm bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                              Henüz kelime eklemedin.
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  }

  function renderProfile() {
      const achievements: Achievement[] = [
          { id: '1', title: 'İlk Adım', description: 'İlk kelimeni öğrendin', icon: '🌱', unlocked: (words.length > 0), progress: Math.min(1, words.length), maxProgress: 1 },
          { id: '2', title: 'Kelime Avcısı', description: '50 kelimeye ulaş', icon: '🏹', unlocked: (words.length >= 50), progress: Math.min(50, words.length), maxProgress: 50 },
          { id: '3', title: 'Ateşli', description: '3 günlük seri yap', icon: '🔥', unlocked: true, progress: 1, maxProgress: 3 }, 
          { id: '4', title: 'Hikaye Anlatıcı', description: 'İlk hikayeni oluştur', icon: '📖', unlocked: (stories.length > 0), progress: stories.length, maxProgress: 1 },
      ];

      return (
          <div className="p-6 pb-28 space-y-8 animate-fade-in max-w-md mx-auto">
              <header className="pt-8 flex justify-between items-start">
                  <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-4xl shadow-inner border border-zinc-200 dark:border-zinc-700">
                        {userProfile?.avatar || '🎓'}
                      </div>
                      <div>
                          <h2 className="text-3xl font-black text-black dark:text-white tracking-tighter mb-1">{userProfile?.username || 'Student'}</h2>
                          <div className="flex items-center gap-2">
                              <span className="bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{userProfile?.level}</span>
                              <span className="text-zinc-500 font-bold text-sm">{userProfile?.goal}</span>
                          </div>
                      </div>
                  </div>
                  <button onClick={() => setView(AppView.SETTINGS)} className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-2xl text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
                      <SettingsIcon size={24} />
                  </button>
              </header>

              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-5 rounded-[2rem] border border-orange-100 dark:border-orange-900/30">
                      <div className="flex items-center gap-2 mb-2 text-orange-600 dark:text-orange-400">
                          <Flame size={20} fill="currentColor" />
                          <span className="text-xs font-bold uppercase tracking-widest">Seri</span>
                      </div>
                      <div className="text-3xl font-black text-black dark:text-white">{userProfile?.streak || 0} <span className="text-sm text-zinc-400 font-medium">Gün</span></div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-[2rem] border border-blue-100 dark:border-blue-900/30">
                      <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400">
                          <Library size={20} />
                          <span className="text-xs font-bold uppercase tracking-widest">Kelime</span>
                      </div>
                      <div className="text-3xl font-black text-black dark:text-white">{words.length}</div>
                  </div>
                  
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-5 rounded-[2rem] border border-yellow-100 dark:border-yellow-900/30 col-span-2 flex items-center justify-between">
                      <div>
                           <div className="flex items-center gap-2 mb-2 text-yellow-600 dark:text-yellow-400">
                              <Trophy size={20} />
                              <span className="text-xs font-bold uppercase tracking-widest">Lig</span>
                          </div>
                          <div className="text-3xl font-black text-black dark:text-white">{userProfile?.league || 'Bronze'}</div>
                          <p className="text-xs text-yellow-600/70 dark:text-yellow-400/70 font-bold mt-1">{userProfile?.xp} XP Toplam</p>
                      </div>
                      <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center text-3xl shadow-sm border border-yellow-100 dark:border-yellow-800">
                          {userProfile?.league === 'Diamond' ? '💎' : userProfile?.league === 'Platinum' ? '💠' : userProfile?.league === 'Gold' ? '🏆' : userProfile?.league === 'Silver' ? '🥈' : '🥉'}
                      </div>
                  </div>

                  <div className="col-span-2 bg-purple-50 dark:bg-purple-900/20 p-5 rounded-[2rem] border border-purple-100 dark:border-purple-900/30 flex justify-between items-center">
                      <div>
                          <div className="flex items-center gap-2 mb-1 text-purple-600 dark:text-purple-400">
                              <Snowflake size={20} />
                              <span className="text-xs font-bold uppercase tracking-widest">Seri Dondurucu</span>
                          </div>
                          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{userProfile?.streakFreeze || 0} dondurucun var.</p>
                      </div>
                      <button 
                        onClick={handleBuyFreeze}
                        className="px-4 py-2 bg-white dark:bg-zinc-900 rounded-xl text-xs font-bold shadow-sm hover:scale-105 active:scale-95 transition-all text-purple-600 dark:text-purple-400 flex flex-col items-center"
                      >
                          <span>+1 Al</span>
                          <span className="text-[10px] opacity-70">200 XP</span>
                      </button>
                  </div>
              </div>

              <div>
                  <h3 className="font-bold text-black dark:text-white text-lg mb-4">Başarılar</h3>
                  <div className="space-y-3">
                      {achievements.map(ach => (
                          <div key={ach.id} className={`p-4 rounded-2xl border flex items-center gap-4 ${ach.unlocked ? 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 shadow-sm' : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800 opacity-60'}`}>
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${ach.unlocked ? 'bg-green-100 dark:bg-green-900/30' : 'bg-zinc-200 dark:bg-zinc-800 grayscale'}`}>
                                  {ach.icon}
                              </div>
                              <div className="flex-1">
                                  <h4 className="font-bold text-black dark:text-white text-sm">{ach.title}</h4>
                                  <p className="text-xs text-zinc-500">{ach.description}</p>
                                  <div className="mt-2 h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-green-500" style={{ width: `${(ach.progress / ach.maxProgress) * 100}%` }}></div>
                                  </div>
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
    return (
        <div className="h-full w-full flex items-center justify-center bg-white dark:bg-black">
            <Loader2 className="animate-spin text-black dark:text-white" size={48} />
        </div>
    );
  }

  if (view === AppView.AUTH) {
    return <Auth onLoginSuccess={() => {}} />;
  }

  if (view === AppView.ONBOARDING) {
      return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="h-screen w-full bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden select-none transition-colors duration-300 flex flex-col">
      
      {showTour && (
          <Tour 
              steps={[
                  { targetId: 'nav-dashboard', title: 'Ana Sayfa', description: 'İlerlemeni, günlük hedeflerini ve serini buradan takip et.', position: 'top' },
                  { targetId: 'action-review', title: 'Tekrar Yap', description: 'Akıllı tekrar sistemi ile kelimeleri unutmadan önce hatırla.', position: 'top' },
                  { targetId: 'action-discover', title: 'Kelime Ekle', description: 'Yapay zeka ile seviyene uygun yeni kelimeler keşfet.', position: 'top' },
                  { targetId: 'nav-studio', title: 'Studio', description: 'Hikayeler oku ve yapay zeka ile konuşarak pratik yap.', position: 'top' },
                  { targetId: 'nav-arena', title: 'Arena', description: 'Oyunlar oyna, XP kazan ve ligde yüksel.', position: 'top' },
              ]}
              onComplete={handleTourComplete}
              onSkip={handleTourComplete}
          />
      )}

      <div className="flex-1 w-full overflow-hidden relative flex flex-col">
        {view === AppView.DASHBOARD && (
            <div className="h-full w-full overflow-y-auto scrollbar-hide">
                {renderDashboard()}
            </div>
        )}
        {view === AppView.STUDY && renderStudy()}
        {view === AppView.DISCOVER && (
            <div className="h-full w-full overflow-y-auto scrollbar-hide">
                {renderDiscover()}
            </div>
        )}
        {view === AppView.STUDIO && renderStudio()}
        {view === AppView.PROFILE && (
            <div className="h-full w-full overflow-y-auto scrollbar-hide">
                {renderProfile()}
            </div>
        )}
        {view === AppView.ARENA && <Arcade userProfile={userProfile} words={words} onAddXP={handleAddXP} leaderboardData={leaderboardData} />}
        {view === AppView.SETTINGS && (
            <Settings 
                userProfile={userProfile} 
                words={words}
                onUpdateProfile={updateProfile} 
                onBack={() => setView(AppView.PROFILE)} 
                onClearData={handleClearData}
                onSignOut={handleSignOut}
            />
        )}
      </div>

      {showLibrary && renderLibrary()}
      {editingWord && renderWordEditor()}
      {selectedWordForAdd && (
          <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-slide-up border border-zinc-100 dark:border-zinc-800 text-center">
                  <h3 className="text-xl font-bold mb-2 text-black dark:text-white">Kelime Bulundu!</h3>
                  <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-xl mb-6">
                      <p className="text-2xl font-black mb-1 text-black dark:text-white">{selectedWordForAdd.term}</p>
                      <p className="text-zinc-500">{selectedWordForAdd.translation}</p>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => setSelectedWordForAdd(null)} className="flex-1 py-3 text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">İptal</button>
                      <button onClick={handleAddWordFromStory} disabled={isLookupLoading} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-200 dark:shadow-none flex items-center justify-center gap-2">
                          {isLookupLoading ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Ekle
                      </button>
                  </div>
              </div>
          </div>
      )}
      {showAutoGenNotification && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[80] bg-black/80 dark:bg-white/90 backdrop-blur-md text-white dark:text-black px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-slide-up">
              <Sparkles className="text-yellow-400 dark:text-yellow-600" size={20} fill="currentColor" />
              <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-widest opacity-80">MemoLingua AI</span>
                  <span className="font-bold text-sm">Günlük kelimelerin hazır!</span>
              </div>
          </div>
      )}

      {view !== AppView.STUDIO && 
       view !== AppView.STUDY && 
       view !== AppView.SETTINGS && 
       !showLibrary && 
       !editingWord &&
       !isKeyboardOpen && (
          <Navigation currentView={view} setView={setView} />
      )}
    </div>
  );
}