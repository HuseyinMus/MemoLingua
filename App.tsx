
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserWord, AppView, SRSState, UserProfile, StudyMode, UserLevel, UserGoal, GeneratedStory, Achievement, LeaderboardEntry, WordData } from './types';
import { generateDailyBatch, generateAudio, playGeminiAudio, generateContextualStory, generateSingleWord } from './services/geminiService';
// Initialize Firebase connection
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

import { Sparkles, Zap, Layers, Volume2, AlignLeft, FileText, Settings as SettingsIcon, ArrowLeft, Trophy, Target, LogOut, CheckCircle2, RotateCcw, ChevronDown, Check, Loader2, Search, ArrowRight, Flame, BrainCircuit, User, Play, Calendar, MoreHorizontal, PenTool, Mic, BookOpen, Moon, Sun, Bell, VolumeX, Shield, PieChart, Award, Trash2, Crown, Lock, Library, Edit2, X, ShoppingBag, Snowflake, Quote, TrendingUp, Grid, Clock, Book, PlusCircle } from 'lucide-react';

const PROFILE_STORAGE_KEY = 'memolingua_profile_v1';
const STORY_STORAGE_KEY = 'memolingua_stories_v1';

// Session tracking interface
interface SessionResult {
    wordId: string;
    term: string;
    isCorrect: boolean;
    grade: string;
}

// Initial Hardcoded Stories
const INITIAL_STORIES: GeneratedStory[] = [
    {
        id: 'story-1',
        title: 'The Silent Station',
        genre: 'Sci-Fi',
        level: 'B1',
        coverGradient: 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500',
        date: Date.now(),
        content: "The station was silent. Too silent. Commander Kael drifted through the zero-gravity corridor, gripping his plasma wrench. The **artificial** gravity had failed three hours ago, leaving everything floating in a chaotic dance. He needed to reach the core. The **reactor** was unstable, pulsing with a dangerous red light. Suddenly, a sound echoed—a metallic clang. He wasn't alone. An alien **entity**, small but fast, darted across the control panel. Kael froze. He had to make a choice: repair the ship or chase the intruder.",
        vocabulary: []
    },
    {
        id: 'story-2',
        title: 'Morning in Istanbul',
        genre: 'Travel',
        level: 'A2',
        coverGradient: 'bg-gradient-to-br from-orange-400 via-red-500 to-pink-500',
        date: Date.now(),
        content: "The sun rose over the Bosphorus, painting the water in gold. Elif walked down the narrow **cobblestone** streets of Balat. The smell of fresh bread and strong tea filled the air. Cats slept on the warm hoods of cars. She stopped at a small cafe. 'One tea, please,' she asked the old man. He smiled and handed her a glass. The city was waking up, full of energy and **ancient** secrets. Today, she would explore the hidden **cisterns** beneath the city.",
        vocabulary: []
    },
    {
        id: 'story-3',
        title: 'The Lost Key',
        genre: 'Mystery',
        level: 'B2',
        coverGradient: 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900',
        date: Date.now(),
        content: "It was a rainy Tuesday when the package arrived. No return address. Just a small, heavy box wrapped in brown paper. Detective Miller opened it carefully. Inside lay a single, rusted key. It looked **ancient**, covered in strange symbols. He recognized one symbol—a serpent eating its tail. The Ouroboros. This key belonged to the **mansion** on the hill, a place abandoned for fifty years. Miller grabbed his coat. The **investigation** was finally beginning.",
        vocabulary: []
    }
];

export default function App() {
  const [view, setView] = useState<AppView>(AppView.AUTH); // Start at AUTH
  const [words, setWords] = useState<UserWord[]>([]);
  const [stories, setStories] = useState<GeneratedStory[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // Leaderboard State
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  
  // Tour State
  const [showTour, setShowTour] = useState(false);
  
  // Stories & Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [activeStory, setActiveStory] = useState<GeneratedStory | null>(null);
  const [selectedWordForAdd, setSelectedWordForAdd] = useState<WordData | null>(null); // For Story Reader Modal
  const [isLookupLoading, setIsLookupLoading] = useState(false); // To handle loading state of word lookup
  const [lookupTerm, setLookupTerm] = useState<string>(''); // To store the term being looked up
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Library / Word Management State
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'new' | 'learning' | 'mastered'>('all');
  
  // Study Mode State
  const [sessionCount, setSessionCount] = useState(0); 
  const [initialSessionSize, setInitialSessionSize] = useState(0);
  const [overrideMode, setOverrideMode] = useState<StudyMode | 'auto'>('auto');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  
  // Audio state for dashboard
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);
  
  // Auto Generation Notification
  const [showAutoGenNotification, setShowAutoGenNotification] = useState(false);

  // LOOP PREVENTION REF
  const lastAutoGenerationRef = useRef<string | null>(null);

  // AUTH & DATA LOAD EFFECT
  useEffect(() => {
    let unsubscribeWords: () => void;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        setLoadingAuth(true);
        if (user) {
            // User is signed in, fetch profile
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const profileData = userDoc.data() as UserProfile;
                    const today = new Date().toDateString();
                    const isNewDay = profileData.lastStudyDate !== today;
                    
                    const updatedProfile: UserProfile = {
                        ...profileData,
                        wordsStudiedToday: isNewDay ? 0 : (profileData.wordsStudiedToday || 0),
                        lastStudyDate: today,
                        uid: user.uid,
                        email: user.email || '',
                        // Add default if missing
                        studyTime: profileData.studyTime || '09:00',
                        lastGeneratedDate: profileData.lastGeneratedDate || '',
                        avatar: profileData.avatar || '🎓' // Fallback for old profiles
                    };
                    
                    setUserProfile(updatedProfile);
                    if (isNewDay) saveProfile(updatedProfile);
                    
                    // Trigger Tour if new user AND onboarding is complete
                    if (updatedProfile.hasCompletedOnboarding && !updatedProfile.hasSeenTour) {
                        setTimeout(() => setShowTour(true), 1500);
                    }
                    
                    // Request Notification Permission on load
                    if ('Notification' in window && Notification.permission === 'default') {
                        Notification.requestPermission();
                    }

                    // REAL-TIME LISTENER FOR WORDS (Sub-collection)
                    const wordsCollectionRef = collection(db, "users", user.uid, "words");
                    unsubscribeWords = onSnapshot(wordsCollectionRef, (snapshot) => {
                        const loadedWords = snapshot.docs.map(doc => doc.data() as UserWord);
                        // Sort by date added desc
                        loadedWords.sort((a, b) => b.dateAdded - a.dateAdded);
                        setWords(loadedWords);
                    }, (error) => {
                        console.error("Error loading words:", error);
                    });

                    // ROUTING LOGIC: Check if onboarding is complete
                    if (!updatedProfile.hasCompletedOnboarding) {
                        setView(AppView.ONBOARDING);
                    } else {
                        setView(AppView.DASHBOARD);
                    }

                } else {
                    // Profile doesn't exist (should have been created in Auth), fallback to Onboarding
                    setView(AppView.ONBOARDING);
                }
            } catch (e) {
                console.warn("Firestore fetch failed.", e);
                // Fallback would go here, but for now we enforce DB connection
                setView(AppView.ONBOARDING);
            }
        } else {
            setUserProfile(null);
            setView(AppView.AUTH);
            setWords([]);
        }
        
        // Load local stories as backup/cache
        const savedStories = localStorage.getItem(STORY_STORAGE_KEY);
        if (savedStories) {
            setStories(JSON.parse(savedStories));
        } else {
            setStories(INITIAL_STORIES); // Set defaults
        }

        setLoadingAuth(false);
    });

    return () => {
        unsubscribeAuth();
        if (unsubscribeWords) unsubscribeWords();
    };
  }, []);
  
  // REAL-TIME LEADERBOARD LISTENER
  useEffect(() => {
      // Listen to the top 50 users by XP
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

  // AUTOMATIC GENERATION CHECKER
  useEffect(() => {
      // Logic: 
      // 1. Check if profile and words are loaded
      // 2. Check if "lastGeneratedDate" is NOT today
      // 3. Check if current time is >= studyTime
      // 4. If all true, trigger generation automatically
      
      const checkAndGenerate = async () => {
          if (!userProfile || !words || isGenerating) return;
          
          const today = new Date().toDateString();
          
          // CRITICAL FIX: Check in-memory ref first to prevent loop during state updates
          if (lastAutoGenerationRef.current === today) return;

          // Double check profile data
          if (userProfile.lastGeneratedDate === today) return; 

          // --- NEW: STRICT DAILY LIMIT CHECK ---
          // Count words generated/studied today. If user met daily target, stop.
          // Note: 'wordsStudiedToday' tracks progress. If >= dailyTarget, we assume user is done for today.
          // However, we want to know if we *generated* words today. Since we don't track generation count separately,
          // we use 'lastGeneratedDate' which is set immediately after generation.
          // The check `userProfile.lastGeneratedDate === today` above handles the database state.
          // The ref handles the in-memory state during the async operation.
          
          const now = new Date();
          const [targetHour, targetMinute] = userProfile.studyTime.split(':').map(Number);
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          
          // Check if time is passed
          const isTimePassed = currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute);
          
          if (isTimePassed) {
              console.log("Auto-generating daily words...");
              // LOCK: Set ref immediately to block re-entry
              lastAutoGenerationRef.current = today;
              
              await handleGenerateDaily(true);
          }
      };
      
      if (userProfile && words.length > 0) {
          // Add a small delay to ensure words are fully loaded from snapshot before we use them for uniqueness check
          const timer = setTimeout(checkAndGenerate, 3000);
          return () => clearTimeout(timer);
      }
  }, [userProfile, words.length]); // Dependencies: profile loaded, words updated

  // Theme Effect
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

  // Save stories locally
  useEffect(() => {
    if (stories.length > 0) {
      localStorage.setItem(STORY_STORAGE_KEY, JSON.stringify(stories));
    }
  }, [stories]);

  // Scientific SRS Logic (Simplified SM-2 with Jitter)
  const dueWords = useMemo(() => {
    const now = Date.now();
    return words.filter(w => w.srs.nextReview <= now).sort((a, b) => a.srs.nextReview - b.srs.nextReview);
  }, [words]);

  // Reset session metrics
  useEffect(() => {
    if (view === AppView.STUDY && initialSessionSize === 0) {
        setInitialSessionSize(dueWords.length);
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
    if (view === AppView.STORIES) {
        // Reset story reader if going back to list
        if (!activeStory) {
            setSelectedWordForAdd(null);
            setIsLookupLoading(false);
        }
    }
    
    // Hide nav bar when in Study mode or using keyboard (global listener approach done in separate change, but logic here helps reset)
    if (view === AppView.STUDY) {
        // Handled via CSS/Component logic in App.tsx render
    }
  }, [view, dueWords.length, activeStory]);
  
  // GLOBAL FOCUS LISTENER TO HIDE NAV ON MOBILE KEYBOARD OPEN
  useEffect(() => {
      const handleFocusIn = (e: FocusEvent) => {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
              document.body.classList.add('keyboard-open');
          }
      };
      
      const handleFocusOut = () => {
          document.body.classList.remove('keyboard-open');
      };
      
      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);
      
      return () => {
          document.removeEventListener('focusin', handleFocusIn);
          document.removeEventListener('focusout', handleFocusOut);
      };
  }, []);

  // FIRESTORE SAVE HELPERS
  const saveProfile = async (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile)); // Local backup
    if (auth.currentUser) {
        try {
            // Save full private profile
            await setDoc(doc(db, "users", auth.currentUser.uid), profile, { merge: true });
            
            // Sync minimal public data to leaderboard
            await setDoc(doc(db, "leaderboard", auth.currentUser.uid), {
                name: profile.username || 'User',
                xp: profile.xp || 0,
                avatar: profile.avatar || '🎓',
                league: profile.league || 'Bronze'
            }, { merge: true });

        } catch(e) { console.warn("Sync failed", e); }
    }
  };

  const saveWordsBatch = async (newWords: UserWord[]) => {
      const user = auth.currentUser;
      if (!user) return;
      
      const batch = writeBatch(db);
      newWords.forEach(word => {
          const wordRef = doc(db, "users", user.uid, "words", word.id);
          batch.set(wordRef, word);
      });
      await batch.commit();
  };
  
  const updateWordInDb = async (word: UserWord) => {
      const user = auth.currentUser;
      if (!user) return;
      await setDoc(doc(db, "users", user.uid, "words", word.id), word, { merge: true });
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
               newStreak += 1; // Continued streak
           } else {
               // Missed a day! Check for freeze
               if ((userProfile.streakFreeze || 0) > 0) {
                   saveProfile({ ...userProfile, streakFreeze: userProfile.streakFreeze - 1 });
                   // Streak preserved
               } else {
                   newStreak = 1; // Reset
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
          username: userProfile?.username || 'Student', // Preserve username if set in Auth
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

  // --- ADVANCED SRS LOGIC ---
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
      // Progression: Meaning -> Translation -> Context -> Writing -> Speaking
      if (streak <= 1) return 'meaning';
      if (streak === 2) return 'translation'; // New phase
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
      
      // Safety check: Don't generate if already generating
      if (isGenerating) return;

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
          
          const today = new Date().toDateString();
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
              // Immediately go to study mode to learn new words
              setView(AppView.STUDY);
          }
          
      } catch (e) { 
          console.error("Generation failed", e); 
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
          // Immediately go to study mode to learn the new word
          setView(AppView.STUDY);
      } catch (e) {
          console.error(e);
          alert("Kelime bulunamadı. Tekrar deneyin.");
      } finally { setIsSearching(false); }
  };

  const handleCreateContextualStory = async () => {
      if (!userProfile) return;
      setIsGeneratingStory(true);
      try {
          const generated = await generateContextualStory(userProfile.level, userProfile.goal);
          const newStory: GeneratedStory = {
              id: crypto.randomUUID(),
              ...generated,
              date: Date.now(),
          };
          setStories(prev => [newStory, ...prev]);
          setActiveStory(newStory);
          updateDailyProgress(0, 50); // XP for reading/generating story
      } catch (e) { 
          console.error(e); 
          alert("Hikaye oluşturulamadı. Lütfen tekrar deneyin.");
      } finally { 
          setIsGeneratingStory(false); 
      }
  };

  const handleAddWordFromStory = async () => {
      if (!selectedWordForAdd || !userProfile) return;
      try {
          // Double check if word already exists to be safe
          const existing = words.find(w => w.term.toLowerCase() === selectedWordForAdd.term.toLowerCase());
          if (existing) {
              setSelectedWordForAdd(null);
              return;
          }

          const newWord: UserWord = {
              ...selectedWordForAdd,
              dateAdded: Date.now(),
              srs: { nextReview: Date.now(), interval: 0, easeFactor: 2.5, streak: 0 }
          };
          
          await saveWordsBatch([newWord]);
          generateAudio(newWord.term).then(audio => {
              if (audio) updateWordInDb({ ...newWord, audioBase64: audio });
          });

          updateDailyProgress(1, 10);
          setSelectedWordForAdd(null);
      } catch (e) { console.error(e); }
  };

  const handleQuickLookup = async (text: string) => {
      if (!userProfile) return;
      
      const cleanText = text.replace(/[^a-zA-Z]/g, ''); // Simple cleanup
      if (!cleanText) return;

      setLookupTerm(cleanText);
      setIsLookupLoading(true);
      
      // 1. Check Library: Instant feedback if user already has it
      const libraryWord = words.find(w => w.term.toLowerCase() === cleanText.toLowerCase());
      if (libraryWord) {
          setSelectedWordForAdd(libraryWord);
          setIsLookupLoading(false);
          return;
      }

      // 2. Check Story Metadata: Instant feedback if pre-generated
      const storyWord = activeStory?.vocabulary?.find(w => w.term.toLowerCase() === cleanText.toLowerCase());
      if (storyWord) {
          setSelectedWordForAdd(storyWord);
          setIsLookupLoading(false);
          return;
      }

      // 3. API Fallback: Open modal with loading state immediately
      setSelectedWordForAdd(null); // Clear previous selection so modal shows loading state
      
      try {
          const data = await generateSingleWord(cleanText, userProfile.level);
          setSelectedWordForAdd(data);
      } catch (e) {
          console.error(e);
          // Optional: Show toast error
      } finally {
          setIsLookupLoading(false);
      }
  };

  const handleUpdateSRS = (wordId: string, newSRS: SRSState) => {
    // Only update locally for UI responsiveness, actual save happens in Result
    setWords(prev => prev.map(w => w.id === wordId ? { ...w, srs: newSRS } : w));
  };

  const handleStudyResult = async (grade: 'again' | 'hard' | 'good' | 'easy') => {
    const currentWord = dueWords[0];
    if (!currentWord) return;

    let { interval, easeFactor, streak, nextReview } = currentWord.srs;
    let xpGained = 0;
    
    // Fuzz Factor: Add small random variance (+/- 5%) to prevent bunching
    const fuzz = (val: number) => val * (0.95 + Math.random() * 0.1);

    // Overdue Bonus
    const actualInterval = (Date.now() - (nextReview - (interval * 24 * 60 * 60 * 1000))) / (24 * 60 * 60 * 1000);
    const overdueBonus = actualInterval > interval ? Math.min(1.5, actualInterval / interval) : 1;

    switch (grade) {
      case 'again':
        interval = 0.0007; // ~1 min
        streak = 0; 
        easeFactor = Math.max(1.3, easeFactor - 0.2); 
        xpGained = 5;
        break;
      case 'hard':
        if (interval < 1) interval = 0.004; // 6 min
        else interval = fuzz(interval * 1.2);
        easeFactor = Math.max(1.3, easeFactor - 0.15); 
        streak = Math.max(0, streak - 1); 
        xpGained = 10;
        break;
      case 'good':
        if (interval < 0.001) interval = 0.007; // 10 min
        else if (interval < 0.01) { interval = 1; streak = 1; }
        else {
            streak++;
            const multiplier = easeFactor * overdueBonus;
            interval = fuzz(interval * multiplier);
        }
        xpGained = 20;
        break;
      case 'easy':
        if (interval < 1) { interval = 1; streak = 2; }
        else {
             streak = Math.max(streak + 1, 3);
             easeFactor += 0.15;
             const multiplier = easeFactor * 1.3 * overdueBonus;
             interval = fuzz(interval * multiplier);
        }
        xpGained = 30;
        break;
    }

    const newNextReview = Date.now() + (interval * 24 * 60 * 60 * 1000);
    const updatedWord: UserWord = { 
        ...currentWord, 
        srs: { nextReview: newNextReview, interval, easeFactor, streak } 
    };

    const result: SessionResult = {
        wordId: updatedWord.id,
        term: updatedWord.term,
        isCorrect: grade === 'good' || grade === 'easy',
        grade: grade
    };
    setSessionResults(prev => [...prev, result]);
    await updateWordInDb(updatedWord);
    setWords(prev => prev.map(w => w.id === updatedWord.id ? updatedWord : w));
    setSessionCount(prev => prev + 1);
    updateDailyProgress(1, xpGained);
  };

  // --- TURKISH TOUR CONFIGURATION ---
  const tourSteps: TourStep[] = [
      {
          targetId: 'daily-focus-card',
          title: 'Günlük Hedef',
          description: 'Burası ilerlemeni takip eder. Seriyi bozmamak için her gün hedeflediğin kelime sayısına ulaş!',
          position: 'bottom'
      },
      {
          targetId: 'action-review',
          title: 'Tekrar Oturumu',
          description: 'Unutmak üzere olduğun kelimeleri tekrar etmek için buraya tıkla. Bilimsel aralıklı tekrar yöntemi kullanıyoruz.',
          position: 'top'
      },
      {
          targetId: 'nav-discover',
          title: 'Kelime Ekle',
          description: 'Buradan yeni kelime paketleri oluşturabilir veya sözlükten arama yapabilirsin.',
          position: 'top'
      },
      {
          targetId: 'nav-arena',
          title: 'Arena',
          description: 'Diğer öğrencilerle yarış, oyunlar oyna ve liderlik tablosunda yüksel.',
          position: 'top'
      }
  ];

  // Library Translations
  const renderLibrary = () => {
    const filteredWords = words.filter(w => {
        if (libraryFilter === 'new') return w.srs.streak === 0;
        if (libraryFilter === 'learning') return w.srs.streak > 0 && w.srs.streak <= 4;
        if (libraryFilter === 'mastered') return w.srs.streak > 4;
        return true;
    });

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6 animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-lg h-[90vh] md:h-[80vh] rounded-t-[2.5rem] md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl animate-slide-up">
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 z-10">
                    <h2 className="text-2xl font-bold text-black dark:text-white">Kütüphanem</h2>
                    <button onClick={() => setShowLibrary(false)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                        <X size={20} className="text-black dark:text-white" />
                    </button>
                </div>
                 <div className="px-6 py-2 flex gap-2 overflow-x-auto scrollbar-hide border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                      <button onClick={() => setLibraryFilter('all')} className={`px-4 py-2 rounded-xl text-xs font-bold ${libraryFilter === 'all' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 dark:bg-zinc-800'}`}>Tümü ({words.length})</button>
                      <button onClick={() => setLibraryFilter('new')} className={`px-4 py-2 rounded-xl text-xs font-bold ${libraryFilter === 'new' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 dark:bg-zinc-800'}`}>Yeni</button>
                      <button onClick={() => setLibraryFilter('learning')} className={`px-4 py-2 rounded-xl text-xs font-bold ${libraryFilter === 'learning' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 dark:bg-zinc-800'}`}>Öğreniliyor</button>
                      <button onClick={() => setLibraryFilter('mastered')} className={`px-4 py-2 rounded-xl text-xs font-bold ${libraryFilter === 'mastered' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 dark:bg-zinc-800'}`}>Ezberlendi</button>
                  </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                     {filteredWords.map(word => (
                          <div key={word.id} className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-4 rounded-2xl flex justify-between items-center group">
                              <div>
                                  <h4 className="font-bold text-black dark:text-white">{word.term}</h4>
                                  <p className="text-xs text-zinc-500">{word.translation}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${word.srs.streak > 4 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                      {word.srs.streak > 4 ? 'Usta' : 'Sev ' + word.srs.streak}
                                  </div>
                              </div>
                          </div>
                      ))}
                </div>
            </div>
        </div>
    );
  };

  const renderDashboard = () => {
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

            {/* Daily Focus Card */}
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
                    
                    {/* Word Progress Bar */}
                    <div className="mb-2 flex justify-between text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                        <span>Günlük İlerleme</span>
                        <span>{Math.round(Math.min(100, ((userProfile?.wordsStudiedToday || 0) / (userProfile?.dailyTarget || 1)) * 100))}%</span>
                    </div>
                    <div className="h-4 w-full bg-zinc-900 dark:bg-black rounded-full overflow-hidden mb-6 border border-zinc-800 relative shadow-inner">
                        <div className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${((userProfile?.wordsStudiedToday || 0) / (userProfile?.dailyTarget || 1)) >= 1 ? 'bg-green-500' : 'bg-white'}`} style={{ width: `${Math.min(100, ((userProfile?.wordsStudiedToday || 0) / (userProfile?.dailyTarget || 1)) * 100)}%` }}></div>
                    </div>

                    {/* Streak Progress vs Longest */}
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
                {showAutoGenNotification && (
                    <div className="absolute inset-x-0 bottom-0 bg-blue-600 p-2 text-center animate-slide-up">
                        <p className="text-xs font-bold text-white flex items-center justify-center gap-1">
                            <Sparkles size={12} /> {userProfile?.dailyTarget} yeni kelime eklendi!
                        </p>
                    </div>
                )}
             </div>
             
             {/* Quick Stats Row */}
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
            
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
                <button 
                    id="action-review"
                    onClick={() => setView(AppView.STUDY)}
                    disabled={dueWords.length === 0}
                    className={`p-5 rounded-[2rem] flex flex-col justify-between h-32 border transition-all active:scale-95 text-left relative overflow-hidden ${dueWords.length > 0 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 border-transparent' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800'}`}
                >
                    <div className="relative z-10 flex justify-between items-start w-full">
                        <div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm"><Layers size={20} className={dueWords.length > 0 ? "text-white" : "text-zinc-400"} /></div>
                        {dueWords.length > 0 && <span className="bg-white text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">{dueWords.length} Hazır</span>}
                    </div>
                    <div className="relative z-10">
                        <div className="font-bold text-xl leading-none mb-1">Tekrar Et</div>
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${dueWords.length > 0 ? 'text-blue-200' : 'text-zinc-400'}`}>Oturumu Başlat</div>
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
            
            {/* Recent Words List */}
            <div>
                 <div className="flex justify-between items-center mb-4 px-1">
                    <h3 className="font-bold text-black dark:text-white text-lg tracking-tight">Son Kelimeler</h3>
                    <button onClick={() => setShowLibrary(true)} className="text-zinc-400 hover:text-black dark:hover:text-white text-xs font-bold uppercase flex items-center gap-1">Tümünü Gör <ArrowRight size={14}/></button>
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
  };
  
  // NEW: Discover Tab (Word Generation)
  const renderDiscover = () => {
      return (
          <div className="p-6 pb-28 space-y-6 animate-fade-in max-w-md mx-auto">
              <header className="pt-8 mb-6">
                  <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-2">Kelime Atölyesi</h2>
                  <p className="text-zinc-500 font-medium">Yeni kelimeler üret veya sözlükten ekle.</p>
              </header>

              {/* Automatic Generator Card */}
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

              {/* Manual Dictionary Search */}
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

              {/* Recently Added Words List */}
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
  };
  
  // NEW: Stories Tab (Reading Only)
  const renderStories = () => {
    // Check if the selected word is already in the library
    const isAlreadyAdded = selectedWordForAdd ? words.some(w => w.term.toLowerCase() === selectedWordForAdd.term.toLowerCase()) : false;

    // --- READER MODE ---
    if (activeStory) {
        return (
            <div className="h-full flex flex-col bg-white dark:bg-zinc-950 animate-fade-in relative z-50">
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
                    <button onClick={() => setActiveStory(null)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <ArrowLeft size={24} className="text-black dark:text-white" />
                    </button>
                    <span className="font-bold text-sm text-zinc-500 uppercase tracking-widest truncate max-w-[200px]">{activeStory.genre}</span>
                    <button className="p-2 -mr-2 text-zinc-400">
                        <MoreHorizontal size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-lg mx-auto w-full">
                    <h1 className="text-3xl md:text-4xl font-black text-black dark:text-white mb-2 leading-tight tracking-tight">{activeStory.title}</h1>
                    <div className="flex items-center gap-3 mb-8">
                        <span className="bg-black dark:bg-white text-white dark:text-black px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{activeStory.level} Level</span>
                        <span className="text-zinc-400 text-xs font-medium">{new Date(activeStory.date).toLocaleDateString()}</span>
                    </div>

                    <div className="prose dark:prose-invert prose-lg leading-loose font-serif text-zinc-800 dark:text-zinc-300">
                        {/* Interactive Text Rendering */}
                        <p>
                            {activeStory.content.split(/(\s+)/).map((part, index) => {
                                // Simple cleaning to remove punctuation for lookup, but keep display intact
                                const cleanWord = part.replace(/[^\w\s]/g, '');
                                if (!cleanWord.trim()) return <span key={index}>{part}</span>;
                                
                                const isPreGenerated = activeStory.vocabulary?.find(v => v.term.toLowerCase() === cleanWord.toLowerCase());
                                
                                return (
                                    <span 
                                        key={index}
                                        onClick={() => handleQuickLookup(cleanWord)}
                                        className={`cursor-pointer transition-colors border-b border-transparent hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 ${
                                            part.includes('**') 
                                                ? 'font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-0.5 rounded border-blue-200 dark:border-blue-800' 
                                                : ''
                                        }`}
                                    >
                                        {part.replace(/\*\*/g, '')}
                                    </span>
                                );
                            })}
                        </p>
                    </div>
                </div>

                {/* Word Detail Modal (Sheet) */}
                {(selectedWordForAdd || isLookupLoading) && (
                    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-end justify-center sm:items-center p-4 animate-fade-in" onClick={() => setSelectedWordForAdd(null)}>
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-slide-up border border-zinc-100 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
                            {isLookupLoading && !selectedWordForAdd ? (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <Loader2 size={32} className="animate-spin text-blue-500 mb-4" />
                                    <p className="text-zinc-500 font-bold">Yapay Zeka Çeviriyor...</p>
                                    <p className="text-xs text-zinc-400 uppercase tracking-widest mt-1">"{lookupTerm}"</p>
                                </div>
                            ) : selectedWordForAdd && (
                                <>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-3xl font-black text-black dark:text-white mb-1">{selectedWordForAdd.term}</h3>
                                            {/* Prominent Turkish Translation */}
                                            <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-1">{selectedWordForAdd.translation}</p>
                                        </div>
                                        <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full text-xs font-bold text-zinc-500 uppercase tracking-wide">
                                            {selectedWordForAdd.type}
                                        </div>
                                    </div>
                                    
                                    <p className="text-zinc-700 dark:text-zinc-300 italic mb-6">"{selectedWordForAdd.definition}"</p>
                                    
                                    {isAlreadyAdded ? (
                                        <button 
                                            disabled
                                            className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                                        >
                                            <CheckCircle2 size={18} /> Zaten Listende
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={handleAddWordFromStory}
                                            className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            <PlusCircle size={18} /> Öğrenme Listeme Ekle
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- LIBRARY LIST MODE ---
    return (
      <div className="p-6 pb-28 space-y-6 animate-fade-in max-w-md mx-auto">
        <header className="pt-8 mb-6">
            <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-2">Hikaye Kitaplığı</h2>
            <p className="text-zinc-500 font-medium">Seviyene uygun, yapay zeka destekli okuma parçaları.</p>
        </header>

        {/* Create New Card */}
        <button 
            onClick={handleCreateContextualStory}
            disabled={isGeneratingStory}
            className="w-full bg-white dark:bg-zinc-900 border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] flex items-center gap-4 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group"
        >
             <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                 {isGeneratingStory ? <Loader2 className="animate-spin" /> : <PenTool size={24} />}
             </div>
             <div className="text-left">
                 <h3 className="font-bold text-lg text-black dark:text-white">Yeni Oluştur</h3>
                 <p className="text-xs text-zinc-500">İlgi alanlarına göre AI hikayesi</p>
             </div>
        </button>

        {/* Story Grid */}
        <div className="grid grid-cols-1 gap-4">
            {stories.map(story => (
                <div 
                    key={story.id}
                    onClick={() => setActiveStory(story)}
                    className={`relative overflow-hidden rounded-[2rem] p-6 h-48 flex flex-col justify-end cursor-pointer shadow-lg hover:scale-[1.02] transition-transform active:scale-95 group ${story.coverGradient || 'bg-gradient-to-br from-gray-800 to-black'}`}
                >
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                    <div className="relative z-10 text-white">
                        <div className="flex justify-between items-start mb-auto">
                            <span className="bg-white/20 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">{story.genre || 'Fiction'}</span>
                            <BookOpen size={20} className="opacity-80" />
                        </div>
                        <h3 className="text-2xl font-black leading-tight mb-1">{story.title}</h3>
                        <p className="text-white/80 text-xs font-medium line-clamp-2 opacity-80">{story.content.substring(0, 60)}...</p>
                    </div>
                </div>
            ))}
        </div>
      </div>
    );
  };

  const renderSessionSummary = () => {
      const correctCount = sessionResults.filter(r => r.isCorrect).length;
      const accuracy = Math.round((correctCount / sessionResults.length) * 100) || 0;
      const totalXP = sessionResults.reduce((acc, curr) => {
          if (curr.grade === 'good') return acc + 20;
          if (curr.grade === 'easy') return acc + 30;
          if (curr.grade === 'hard') return acc + 10;
          return acc + 5;
      }, 0);
      const timeTaken = Math.round((Date.now() - sessionStartTime) / 1000 / 60);

      return (
          <div className="h-full flex flex-col p-6 animate-slide-up max-w-md mx-auto overflow-y-auto pb-10">
              <div className="text-center mb-8 pt-8">
                  <div className="w-32 h-32 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center animate-bounce mx-auto mb-4 border-4 border-yellow-200 dark:border-yellow-700">
                       <Trophy size={64} className="text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <h2 className="text-4xl font-black text-black dark:text-white mb-2 tracking-tighter">Oturum Tamamlandı!</h2>
                  <p className="text-zinc-500 font-medium text-lg">Harika bir iş çıkardın.</p>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                   <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
                       <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Doğruluk</p>
                       <p className={`text-3xl font-black ${accuracy >= 80 ? 'text-green-500' : 'text-orange-500'}`}>%{accuracy}</p>
                   </div>
                   <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
                       <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">XP Kazanılan</p>
                       <p className="text-3xl font-black text-yellow-500">+{totalXP}</p>
                   </div>
                   <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
                       <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Süre</p>
                       <p className="text-3xl font-black text-blue-500">{timeTaken}dk</p>
                   </div>
                   <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
                       <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Kelime</p>
                       <p className="text-3xl font-black text-black dark:text-white">{sessionResults.length}</p>
                   </div>
              </div>

              {/* Reviewed Words List */}
              <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-[2rem] p-6 mb-8">
                  <h3 className="font-bold text-black dark:text-white mb-4">İncelenen Kelimeler</h3>
                  <div className="space-y-3">
                      {sessionResults.map((res, i) => (
                          <div key={i} className="flex items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                              <span className="font-medium text-black dark:text-white">{res.term}</span>
                              <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md uppercase ${res.isCorrect ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                  {res.isCorrect ? <Check size={12} /> : <X size={12} />}
                                  {res.grade}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              <button 
                onClick={() => setView(AppView.DASHBOARD)}
                className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-transform mt-auto"
              >
                  Ana Sayfaya Dön
              </button>
          </div>
      );
  };

  const renderStudy = () => {
    // If no words left AND we have results, show summary
    if (dueWords.length === 0 && sessionResults.length > 0) {
        return renderSessionSummary();
    }

    if (dueWords.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in max-w-md mx-auto">
                <div className="w-32 h-32 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 animate-bounce">
                    <CheckCircle2 size={64} className="text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-4xl font-black text-black dark:text-white mb-2 tracking-tighter">Harika!</h2>
                <p className="text-zinc-500 text-lg mb-8">Bugünlük tekrar edilecek kelime kalmadı.</p>
                <div className="grid grid-cols-1 gap-3 w-full">
                    <button onClick={() => setView(AppView.DASHBOARD)} className="bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-transform">
                        Ana Ekrana Dön
                    </button>
                    <button onClick={() => setView(AppView.ARENA)} className="bg-zinc-100 dark:bg-zinc-900 text-black dark:text-white py-4 rounded-2xl font-bold active:scale-95 transition-transform">
                        Arena'ya Git
                    </button>
                </div>
            </div>
        );
    }

    const currentWord = dueWords[0];
    const mode = getStudyModeForWord(currentWord);

    return (
        <div className="h-full flex flex-col bg-zinc-50 dark:bg-black">
            {/* Header */}
            {/* Navigation is hidden in Study mode, so we rely on this header */}
            <div className="px-6 py-4 flex items-center justify-between shrink-0">
                <button onClick={() => setView(AppView.DASHBOARD)} className="p-2 bg-white dark:bg-zinc-900 rounded-full shadow-sm text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                </button>
                
                {/* Progress Bar */}
                <div className="flex-1 mx-4">
                     <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                         <div 
                            className="h-full bg-black dark:bg-white transition-all duration-500 ease-out" 
                            style={{ width: `${(sessionCount / initialSessionSize) * 100}%` }}
                        />
                     </div>
                </div>

                {/* Mode Selector */}
                <div className="relative">
                    <button 
                        onClick={() => setShowModeMenu(!showModeMenu)}
                        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 rounded-full text-xs font-bold border border-zinc-200 dark:border-zinc-800 shadow-sm"
                    >
                       <span className="uppercase tracking-wider hidden md:inline">{overrideMode === 'auto' ? 'Otomatik' : overrideMode}</span>
                       <ChevronDown size={14} />
                    </button>
                    
                    {showModeMenu && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-800 py-2 z-50 animate-slide-up flex flex-col overflow-hidden">
                            {['auto', 'meaning', 'translation', 'context', 'writing', 'speaking'].map((m) => (
                                <button 
                                    key={m}
                                    onClick={() => { setOverrideMode(m as any); setShowModeMenu(false); }}
                                    className={`px-4 py-3 text-left text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 capitalize ${overrideMode === m ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white font-bold' : 'text-zinc-500'}`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Card Area */}
            <div className="flex-1 p-4 pb-8 flex flex-col justify-center max-w-md mx-auto w-full">
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
  };

  const renderProfile = () => {
      const achievements: Achievement[] = [
          { id: '1', title: 'İlk Adım', description: 'İlk kelimeni öğrendin', icon: '🌱', unlocked: (words.length > 0), progress: Math.min(1, words.length), maxProgress: 1 },
          { id: '2', title: 'Kelime Avcısı', description: '50 kelimeye ulaş', icon: '🏹', unlocked: (words.length >= 50), progress: Math.min(50, words.length), maxProgress: 50 },
          { id: '3', title: 'Ateşli', description: '3 günlük seri yap', icon: '🔥', unlocked: true, progress: 1, maxProgress: 3 }, // Mock
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

              {/* Stats Grid */}
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
                  
                  {/* XP & League */}
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

                  {/* Shop / Streak Freeze */}
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

              {/* Achievements */}
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
  };
  
  if (loadingAuth) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-white dark:bg-zinc-950">
              <Loader2 className="animate-spin text-zinc-400" size={32} />
          </div>
      );
  }

  return (
    <div className="h-full w-full bg-background dark:bg-zinc-950 relative selection:bg-black selection:text-white">
      <main className="h-full overflow-y-auto scrollbar-hide transition-colors duration-300">
        {view === AppView.AUTH && <Auth onLoginSuccess={() => {}} />} 
        {view === AppView.ONBOARDING && <Onboarding onComplete={handleOnboardingComplete} />}
        {view === AppView.DASHBOARD && renderDashboard()}
        {view === AppView.DISCOVER && renderDiscover()} 
        {view === AppView.STORIES && renderStories()}
        {view === AppView.STUDY && renderStudy()}
        {view === AppView.PROFILE && renderProfile()} 
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
        {view === AppView.ARENA && <Arcade userProfile={userProfile} words={words} onAddXP={handleAddXP} leaderboardData={leaderboardData} />}
      </main>
      
      {showLibrary && renderLibrary()}
      
      {showTour && view === AppView.DASHBOARD && (
          <Tour steps={tourSteps} onComplete={handleTourComplete} onSkip={handleTourComplete} />
      )}

      {/* Hide Navigation in Study Mode or Auth/Onboarding */}
      {view !== AppView.ONBOARDING && view !== AppView.STUDY && view !== AppView.AUTH && (
        <Navigation currentView={view} setView={setView} />
      )}
    </div>
  );
}
