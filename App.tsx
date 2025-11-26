
import React, { useState, useEffect, useMemo } from 'react';
import { UserWord, AppView, SRSState, UserProfile, StudyMode, UserLevel, UserGoal, GeneratedStory, Achievement } from './types';
import { generateDailyBatch, generateAudio, playGeminiAudio, generateStoryFromWords, generateSingleWord } from './services/geminiService';
// Initialize Firebase connection
import { auth, db } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, writeBatch } from 'firebase/firestore';

import { Navigation } from './components/Navigation';
import { StudyCard } from './components/StudyCard';
import { Onboarding } from './components/Onboarding';
import { Arcade } from './components/Arcade';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { Tour, TourStep } from './components/Tour';

import { Sparkles, Zap, Layers, Volume2, AlignLeft, FileText, Settings as SettingsIcon, ArrowLeft, Trophy, Target, LogOut, CheckCircle2, RotateCcw, ChevronDown, Check, Loader2, Search, ArrowRight, Flame, BrainCircuit, User, Play, Calendar, MoreHorizontal, PenTool, Mic, BookOpen, Moon, Sun, Bell, VolumeX, Shield, PieChart, Award, Trash2, Crown, Lock, Library, Edit2, X, ShoppingBag, Snowflake, Quote, TrendingUp, Grid, Clock } from 'lucide-react';

const PROFILE_STORAGE_KEY = 'memolingua_profile_v1';
const STORY_STORAGE_KEY = 'memolingua_stories_v1';

export default function App() {
  const [view, setView] = useState<AppView>(AppView.AUTH); // Start at AUTH
  const [words, setWords] = useState<UserWord[]>([]);
  const [stories, setStories] = useState<GeneratedStory[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // Tour State
  const [showTour, setShowTour] = useState(false);
  
  // Discover Mode State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [activeStory, setActiveStory] = useState<GeneratedStory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Library / Word Management State
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'new' | 'learning' | 'mastered'>('all');
  const [editingWord, setEditingWord] = useState<UserWord | null>(null);
  
  // Study Mode State
  const [sessionCount, setSessionCount] = useState(0); 
  const [initialSessionSize, setInitialSessionSize] = useState(0);
  const [overrideMode, setOverrideMode] = useState<StudyMode | 'auto'>('auto');
  const [showModeMenu, setShowModeMenu] = useState(false);
  
  // Audio state for dashboard
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);
  
  // Auto Generation Notification
  const [showAutoGenNotification, setShowAutoGenNotification] = useState(false);

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
                    
                    const updatedProfile = {
                        ...profileData,
                        wordsStudiedToday: isNewDay ? 0 : (profileData.wordsStudiedToday || 0),
                        lastStudyDate: today,
                        uid: user.uid,
                        email: user.email || '',
                        // Add default if missing
                        studyTime: profileData.studyTime || '09:00',
                        lastGeneratedDate: profileData.lastGeneratedDate || ''
                    };
                    
                    setUserProfile(updatedProfile);
                    if (isNewDay) saveProfile(updatedProfile);
                    
                    // Trigger Tour if new user
                    if (!updatedProfile.hasSeenTour) {
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

                    setView(AppView.DASHBOARD);
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
        if (savedStories) setStories(JSON.parse(savedStories));

        setLoadingAuth(false);
    });

    return () => {
        unsubscribeAuth();
        if (unsubscribeWords) unsubscribeWords();
    };
  }, []);
  
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
          if (userProfile.lastGeneratedDate === today) return; // Already generated today
          
          const now = new Date();
          const [targetHour, targetMinute] = userProfile.studyTime.split(':').map(Number);
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          
          // Check if time is passed
          const isTimePassed = currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute);
          
          if (isTimePassed) {
              console.log("Auto-generating daily words...");
              // We pass 'true' to indicate this is an auto-generation to prevent duplicate saves/logic issues if needed
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

  // Scientific SRS Logic (Simplified SM-2)
  const dueWords = useMemo(() => {
    const now = Date.now();
    return words.filter(w => w.srs.nextReview <= now).sort((a, b) => a.srs.nextReview - b.srs.nextReview);
  }, [words]);

  // Reset session metrics
  useEffect(() => {
    if (view === AppView.STUDY && initialSessionSize === 0) {
        setInitialSessionSize(dueWords.length);
        setSessionCount(0);
    }
    if (view === AppView.DASHBOARD) {
        setInitialSessionSize(0);
        setSessionCount(0);
        setShowModeMenu(false);
        setOverrideMode('auto');
    }
  }, [view, dueWords.length]);

  // FIRESTORE SAVE HELPERS
  const saveProfile = async (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile)); // Local backup
    if (auth.currentUser) {
        try {
            await setDoc(doc(db, "users", auth.currentUser.uid), profile, { merge: true });
        } catch(e) { console.warn("Sync failed"); }
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
  
  const deleteWordFromDb = async (wordId: string) => {
       const user = auth.currentUser;
       if (!user) return;
       // Logic handled locally via snapshot update
  };

  const updateDailyProgress = (wordCount: number, xpGained: number = 0) => {
      if (!userProfile) return;
      const today = new Date().toDateString();
      const isNewDay = userProfile.lastStudyDate !== today;
      const newCount = isNewDay ? wordCount : (userProfile.wordsStudiedToday || 0) + wordCount;
      const newXp = (userProfile.xp || 0) + xpGained;
      saveProfile({ ...userProfile, wordsStudiedToday: newCount, lastStudyDate: today, xp: newXp });
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
        setStories([]);
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
    const formatDuration = (days: number) => {
      if (days < 1/24/60) return '1dk';
      if (days < 1) return '1g';
      return `${Math.round(days)}g`;
    };
    return {
      again: '1dk',
      hard: formatDuration(Math.max(1, interval * 1.2)),
      good: formatDuration(Math.max(1, (interval === 0 ? 1 : interval) * word.srs.easeFactor)),
      easy: formatDuration(Math.max(4, (interval === 0 ? 1 : interval) * word.srs.easeFactor * 1.3))
    };
  };

  const getStudyModeForWord = (word: UserWord): StudyMode => {
      if (overrideMode !== 'auto') return overrideMode;
      const streak = word.srs.streak;
      if (streak <= 1) return 'meaning';
      if (streak <= 3) return 'context';
      if (streak <= 5) return 'writing';
      return 'speaking';
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
      setIsGenerating(true);
      try {
          const targetCount = userProfile.dailyTarget || 10;
          // IMPORTANT: Pass ALL existing terms to ensure uniqueness
          const existingTerms = words.map(w => w.term);
          
          const newBatch = await generateDailyBatch(targetCount, userProfile.level, userProfile.goal, existingTerms);

          const newWords: UserWord[] = newBatch.map(w => ({
              ...w,
              dateAdded: Date.now(),
              srs: { nextReview: Date.now(), interval: 0, easeFactor: 2.5, streak: 0 }
          }));

          // Save to Firestore!
          await saveWordsBatch(newWords);
          
          // Update profile to mark today as generated
          const today = new Date().toDateString();
          saveProfile({ ...userProfile, lastGeneratedDate: today });

          // Generate audio in background
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
              // Show notification if supported
              if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification("MemoLingua", { body: `${newWords.length} yeni kelimen hazır! Çalışmaya başla.`, icon: '/icon.png' });
              }
              setShowAutoGenNotification(true);
              setTimeout(() => setShowAutoGenNotification(false), 5000);
          } else {
              setView(AppView.DASHBOARD);
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
          alert(`"${newWord.term}" kelimesi eklendi!`);
      } catch (e) {
          console.error(e);
          alert("Kelime bulunamadı. Tekrar deneyin.");
      } finally { setIsSearching(false); }
  };

  const handleGenerateStory = async () => {
      if (!userProfile || words.length === 0) return;
      setIsGeneratingStory(true);
      try {
          const storyWords = [...words].sort(() => 0.5 - Math.random()).slice(0, 8);
          const generated = await generateStoryFromWords(storyWords, userProfile.level);
          const newStory: GeneratedStory = {
              id: crypto.randomUUID(),
              title: generated.title,
              content: generated.content,
              date: Date.now(),
              wordIds: generated.wordIds
          };
          setStories(prev => [newStory, ...prev]);
          setActiveStory(newStory);
          updateDailyProgress(0, 50);
      } catch (e) { console.error(e); } finally { setIsGeneratingStory(false); }
  };

  const handleUpdateSRS = (wordId: string, newSRS: SRSState) => {
    // Only update locally for UI responsiveness, actual save happens in Result
    setWords(prev => prev.map(w => w.id === wordId ? { ...w, srs: newSRS } : w));
  };

  const handleStudyResult = async (grade: 'again' | 'hard' | 'good' | 'easy') => {
    const currentWord = dueWords[0];
    if (!currentWord) return;

    let { interval, easeFactor, streak } = currentWord.srs;
    let nextIntervalDays = 0;
    let xpGained = 0;

    switch (grade) {
      case 'again':
        streak = 0; interval = 0; easeFactor = Math.max(1.3, easeFactor - 0.2); nextIntervalDays = 0.0007; xpGained = 5;
        break;
      case 'hard':
        streak = 0; interval = Math.max(1, interval * 1.2); easeFactor = Math.max(1.3, easeFactor - 0.15); nextIntervalDays = interval; xpGained = 10;
        break;
      case 'good':
        streak++; interval = streak === 1 ? 1 : (streak === 2 ? 6 : Math.ceil(interval * easeFactor)); nextIntervalDays = interval; xpGained = 20;
        break;
      case 'easy':
        streak = Math.max(streak + 1, 3); interval = streak === 1 ? 4 : Math.ceil(interval * easeFactor * 1.3); easeFactor += 0.15; nextIntervalDays = interval; xpGained = 30;
        break;
    }

    const nextReview = Date.now() + (nextIntervalDays * 24 * 60 * 60 * 1000);
    const updatedWord: UserWord = { ...currentWord, srs: { nextReview, interval, easeFactor, streak } };

    // Update DB
    await updateWordInDb(updatedWord);

    // Update Local State (Snapshot will handle it, but for instant UI response):
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
          targetId: 'action-discover',
          title: 'Keşfet & Ekle',
          description: 'Yapay zeka ile seviyene uygun yeni kelime setleri oluştur veya hikayeler yarat.',
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
    // ... Greeting Logic ...
    const hours = new Date().getHours();
    const greeting = hours < 12 ? 'Günaydın' : hours < 18 ? 'Tünaydın' : 'İyi Akşamlar';
    // ...
    return (
        <div className="p-6 pb-28 space-y-6 animate-fade-in max-w-md mx-auto">
            <header className="flex justify-between items-center pt-8">
                <div className="flex items-center gap-3">
                    <button onClick={() => setView(AppView.PROFILE)} className="w-10 h-10 rounded-full bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center font-bold">
                        {userProfile?.username?.charAt(0).toUpperCase() || <User size={20} />}
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
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tighter mb-1">Günlük Odak</h2>
                            <p className="text-zinc-400 text-xs font-medium flex items-center gap-1"><Flame size={12} className="text-orange-500" /> Seriyi koru</p>
                        </div>
                        <div className="text-right bg-white/10 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/5">
                            <div className="text-2xl font-bold leading-none">{userProfile?.wordsStudiedToday || 0}</div>
                            <div className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">/ {userProfile?.dailyTarget || 10} Kelime</div>
                        </div>
                    </div>
                     {/* Progress Bar (Same logic) */}
                     <div className="h-4 w-full bg-zinc-900 dark:bg-black rounded-full overflow-hidden mb-6 border border-zinc-800 relative">
                        <div className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${((userProfile?.wordsStudiedToday || 0) / (userProfile?.dailyTarget || 1)) >= 1 ? 'bg-green-500' : 'bg-white'}`} style={{ width: `${Math.min(100, ((userProfile?.wordsStudiedToday || 0) / (userProfile?.dailyTarget || 1)) * 100)}%` }}></div>
                    </div>
                </div>
                
                {/* Auto Gen Notification Banner */}
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
                    <div className="bg-zinc-50 dark:bg-zinc-800 w-10 h-10 rounded-full flex items-center justify-center"><Sparkles size={20} className="text-black dark:text-white" /></div>
                    <div>
                        <div className="font-bold text-xl leading-none mb-1 text-black dark:text-white">Keşfet</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">Kelime Ekle</div>
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
  
  const renderDiscover = () => (
    <div className="p-6 pb-28 space-y-8 animate-fade-in max-w-md mx-auto">
      <div className="pt-8 mb-2">
        <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter">Keşfet</h2>
        <p className="text-zinc-500 font-medium">Yeni kelimeler ve hikayeler.</p>
      </div>

      {/* Search Bar */}
      <div className="relative z-20">
        <div className="flex gap-2">
           <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
              <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Kelime ara..."
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 pl-12 rounded-2xl outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all shadow-sm"
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
      </div>

      {/* Generate Actions */}
      <div className="grid grid-cols-1 gap-4">
          <button 
              onClick={() => handleGenerateDaily(false)}
              disabled={isGenerating}
              className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2rem] text-white shadow-lg shadow-blue-500/30 relative overflow-hidden group text-left"
          >
              <div className="relative z-10">
                  <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
                      {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles size={24} />}
                  </div>
                  <h3 className="text-2xl font-bold mb-1">Günlük Set</h3>
                  <p className="text-blue-100 text-sm font-medium">Yapay zeka ile seviyene uygun {userProfile?.dailyTarget} yeni kelime üret.</p>
              </div>
          </button>

          <button 
              onClick={handleGenerateStory}
              disabled={isGeneratingStory || words.length < 5}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm relative overflow-hidden group text-left hover:border-black dark:hover:border-white transition-colors"
          >
              <div className="relative z-10">
                  <div className="bg-zinc-100 dark:bg-zinc-800 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-black dark:text-white">
                      {isGeneratingStory ? <Loader2 className="animate-spin" /> : <PenTool size={24} />}
                  </div>
                  <h3 className="text-2xl font-bold mb-1 text-black dark:text-white">Hikaye Yarat</h3>
                  <p className="text-zinc-500 text-sm font-medium">Öğrendiğin kelimeleri içeren kısa bir hikaye oluştur.</p>
              </div>
          </button>
      </div>

      {/* Stories List */}
      <div>
          <h3 className="font-bold text-black dark:text-white text-lg mb-4">Hikayelerim</h3>
          <div className="space-y-4">
              {stories.map(story => (
                  <div key={story.id} className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                      <h4 className="font-bold text-lg mb-2 text-black dark:text-white">{story.title}</h4>
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 font-serif">
                          {story.content.split('**').map((part, i) => 
                              i % 2 === 1 ? <span key={i} className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1 rounded">{part}</span> : part
                          )}
                      </div>
                  </div>
              ))}
              {stories.length === 0 && (
                  <div className="text-center py-8 text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                      <BookOpen className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-medium">Henüz hikaye yok.</p>
                  </div>
              )}
          </div>
      </div>
    </div>
  );

  const renderStudy = () => {
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
            <div className="px-6 py-4 flex items-center justify-between shrink-0">
                <button onClick={() => setView(AppView.DASHBOARD)} className="p-2 bg-white dark:bg-zinc-900 rounded-full shadow-sm text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                </button>
                
                {/* Mode Selector */}
                <div className="relative">
                    <button 
                        onClick={() => setShowModeMenu(!showModeMenu)}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 rounded-full text-xs font-bold border border-zinc-200 dark:border-zinc-800 shadow-sm"
                    >
                       <span className="uppercase tracking-wider">{overrideMode === 'auto' ? 'Otomatik Mod' : overrideMode}</span>
                       <ChevronDown size={14} />
                    </button>
                    
                    {showModeMenu && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-800 py-2 z-50 animate-slide-up flex flex-col overflow-hidden">
                            {['auto', 'meaning', 'context', 'writing', 'speaking'].map((m) => (
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

                <div className="text-xs font-bold text-zinc-400 tabular-nums">
                    {sessionCount + 1} / {initialSessionSize}
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
                  <div>
                      <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-2">Profil</h2>
                      <div className="flex items-center gap-2">
                          <span className="bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{userProfile?.level}</span>
                          <span className="text-zinc-500 font-bold text-sm">{userProfile?.goal}</span>
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
                      <div className="text-3xl font-black text-black dark:text-white">1 <span className="text-sm text-zinc-400 font-medium">Gün</span></div>
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
                              <span className="text-xs font-bold uppercase tracking-widest">Toplam XP</span>
                          </div>
                          <div className="text-3xl font-black text-black dark:text-white">{userProfile?.xp}</div>
                      </div>
                      <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center text-2xl shadow-sm">
                          🏆
                      </div>
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
        {view === AppView.ARENA && <Arcade userProfile={userProfile} words={words} onAddXP={handleAddXP} />}
      </main>
      
      {showLibrary && renderLibrary()}
      
      {showTour && view === AppView.DASHBOARD && (
          <Tour steps={tourSteps} onComplete={handleTourComplete} onSkip={handleTourComplete} />
      )}

      {view !== AppView.ONBOARDING && view !== AppView.STUDY && view !== AppView.AUTH && (
        <Navigation currentView={view} setView={setView} />
      )}
    </div>
  );
}
