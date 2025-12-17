
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserWord, AppView, SRSState, UserProfile, StudyMode, UserLevel, UserGoal, GeneratedStory, LeaderboardEntry, WordData, ChatMessage, SRSHistoryItem, Quest } from './types';
import { generateDailyBatch, generateAudio, playGeminiAudio, generateContextualStory, generateSingleWord, generateRoleplayResponse, generatePhrasalVerbBatch } from './services/geminiService';
import { auth, db } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, writeBatch, updateDoc, serverTimestamp } from 'firebase/firestore';

import { Navigation } from './components/Navigation';
import { StudyCard } from './components/StudyCard';
import { Onboarding } from './components/Onboarding';
import { Games } from './components/Games';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { VoiceTalk } from './components/VoiceTalk';
import { Collection } from './components/Collection';
import { Discover } from './components/Discover';
import { Studio } from './components/Studio';
import { Profile } from './components/Profile';
import { Shimmer } from './components/Shimmer';

import { Sparkles, Zap, Layers, Volume2, Settings as SettingsIcon, ArrowLeft, Trophy, Target, CheckCircle2, MoreHorizontal, BookOpen, Search, ArrowRight, Flame, BrainCircuit, Play, Edit2, X, Send, MessageSquare, Loader2, Snowflake, Mic, BookMarked, BarChart3, Camera, Wand2, Plus, Command, Check } from 'lucide-react';

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
    return {
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
};

export default function App() {
  const [view, setView] = useState<AppView>(AppView.AUTH);
  const [words, setWords] = useState<UserWord[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingWords, setLoadingWords] = useState(true);
  const [isGeneratingWords, setIsGeneratingWords] = useState(false);
  const [generatedBatch, setGeneratedBatch] = useState<WordData[] | null>(null);
  
  useEffect(() => {
    const theme = userProfile?.theme || 'system';
    const root = window.document.documentElement;
    const applyTheme = (t: 'light' | 'dark') => {
        root.classList.remove('light', 'dark');
        root.classList.add(t);
    };
    if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        applyTheme(systemTheme);
    } else {
        applyTheme(theme as 'light' | 'dark');
    }
  }, [userProfile?.theme]);

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
                    const profileData = cleanProfile(userDoc.data());
                    setUserProfile({ ...profileData, uid: user.uid, email: user.email || '' });
                    setLoadingWords(true);
                    const wordsCollectionRef = collection(db, "users", user.uid, "words");
                    unsubscribeWords = onSnapshot(wordsCollectionRef, (snapshot) => {
                        if (!isMounted) return;
                        setWords(snapshot.docs.map(doc => cleanWord({ ...doc.data(), id: doc.id })));
                        setLoadingWords(false);
                    }, (err) => {
                        console.warn("Kelimeler yüklenirken hata oluştu.");
                        setLoadingWords(false);
                    });
                    setView(profileData.hasCompletedOnboarding ? AppView.DASHBOARD : AppView.ONBOARDING);
                } else if (isMounted) setView(AppView.ONBOARDING);
            } catch (e) { if(isMounted) setView(AppView.ONBOARDING); }
        } else {
            if(isMounted) { setUserProfile(null); setView(AppView.AUTH); setWords([]); }
        }
        if(isMounted) setLoadingAuth(false);
    });
    return () => { isMounted = false; unsubscribeAuth(); if (unsubscribeWords) unsubscribeWords(); };
  }, []);

  const saveProfile = async (profile: UserProfile) => {
    const cleaned = cleanProfile(profile);
    setUserProfile(cleaned);
    try {
        if (auth.currentUser) await setDoc(doc(db, "users", auth.currentUser.uid), cleaned, { merge: true });
    } catch (err) {
        console.warn("Profil kaydedilemedi, geçici oturum devam ediyor.");
    }
  };

  const handleAddXP = (amount: number) => {
      if (!userProfile) return;
      saveProfile({ ...userProfile, xp: (userProfile.xp || 0) + amount });
  };

  const handleUpdateProfile = (key: keyof UserProfile, value: any) => {
      if (!userProfile) return;
      saveProfile({ ...userProfile, [key]: value });
  };

  const handleAddWords = async (newWords: WordData[]) => {
      if (!auth.currentUser) return;
      try {
          const batch = writeBatch(db);
          newWords.forEach(word => {
              const docRef = doc(collection(db, "users", auth.currentUser!.uid, "words"));
              batch.set(docRef, cleanWord({
                  ...word,
                  dateAdded: Date.now(),
                  srs: { nextReview: Date.now(), interval: 0, easeFactor: 2.5, streak: 0 }
              }));
          });
          await batch.commit();
      } catch (err) {
          console.warn("Kelimeler kaydedilemedi.");
      }
  };

  const handleGenerateDailyBatch = async () => {
      if (!userProfile || isGeneratingWords) return;
      setIsGeneratingWords(true);
      try {
          const existingTerms = words.map(w => w.term);
          const newWords = await generateDailyBatch(userProfile.dailyTarget, userProfile.level, userProfile.goal, existingTerms);
          await handleAddWords(newWords);
          handleUpdateProfile('lastGeneratedDate', new Date().toDateString());
          handleAddXP(50);
          setGeneratedBatch(newWords);
      } catch (e) { console.error(e); } finally { setIsGeneratingWords(false); }
  };

  const updateSRS = async (word: UserWord, grade: 'again' | 'hard' | 'good' | 'easy') => {
      if (!auth.currentUser) return;
      const dayInMs = 24 * 60 * 60 * 1000;
      let newInterval = word.srs.interval;
      let newEase = word.srs.easeFactor;
      let nextReview = Date.now();
      if (grade === 'again') {
          newInterval = 0;
          nextReview = Date.now() + (10 * 60 * 1000); 
      } else if (grade === 'hard') {
          newInterval = Math.max(1, Math.round(newInterval * 1.2));
          nextReview = Date.now() + (newInterval * dayInMs);
          newEase = Math.max(1.3, newEase - 0.15);
      } else if (grade === 'good') {
          newInterval = Math.max(1, newInterval === 0 ? 1 : Math.round(newInterval * newEase));
          nextReview = Date.now() + (newInterval * dayInMs);
      } else if (grade === 'easy') {
          newInterval = Math.max(4, Math.round(newInterval * newEase * 1.3));
          nextReview = Date.now() + (newInterval * dayInMs);
          newEase = newEase + 0.15;
      }
      try {
          const wordDocRef = doc(db, "users", auth.currentUser.uid, "words", word.id);
          await updateDoc(wordDocRef, {
              "srs.nextReview": nextReview,
              "srs.interval": newInterval,
              "srs.easeFactor": newEase,
              "srs.streak": grade === 'again' ? 0 : (word.srs.streak + 1)
          });
          handleAddXP(10);
      } catch (err) {
          console.warn("SRS güncellenemedi.");
      }
  };

  const dueWords = useMemo(() => {
    const now = Date.now();
    return words.filter(w => w.srs.nextReview <= now).sort((a, b) => a.srs.nextReview - b.srs.nextReview);
  }, [words]);

  const needsDailyBatch = useMemo(() => {
      return userProfile?.lastGeneratedDate !== new Date().toDateString();
  }, [userProfile]);

  const currentStudyMode = useMemo((): StudyMode => {
      if (dueWords.length === 0) return 'meaning';
      const streak = dueWords[0].srs.streak;
      if (streak % 4 === 1) return 'context';
      if (streak % 4 === 2) return 'writing';
      if (streak % 4 === 3) return 'speaking';
      return 'meaning';
  }, [dueWords]);

  if (loadingAuth) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-10 space-y-6">
        <div className="w-20 h-20 bg-black dark:bg-white rounded-[2rem] flex items-center justify-center animate-bounce shadow-2xl">
            <Sparkles size={32} className="text-white dark:text-black" />
        </div>
        <div className="w-full max-w-xs space-y-3">
            <Shimmer className="h-4 w-3/4 mx-auto" />
            <Shimmer className="h-2 w-1/2 mx-auto" />
        </div>
    </div>
  );

  return (
    <div className="h-[100dvh] w-full bg-zinc-50 dark:bg-zinc-950 text-black dark:text-white font-sans overflow-hidden flex flex-col transition-colors duration-500">
        <main className="flex-1 w-full overflow-hidden relative">
            {view === AppView.AUTH && <Auth onLoginSuccess={() => {}} />}
            {view === AppView.ONBOARDING && <Onboarding onComplete={(p) => saveProfile(p)} />}
            {view === AppView.DASHBOARD && (
                <div className="h-full overflow-y-auto p-6 space-y-6 max-w-md mx-auto pt-12 scrollbar-hide animate-fade-in">
                    <header className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setView(AppView.PROFILE)} className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center text-xl shadow-lg border border-zinc-100 dark:border-white/10 active:scale-90 transition-transform">{userProfile?.avatar}</button>
                            <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Hoş Geldin</p>
                                <h2 className="font-black text-lg">{userProfile?.username}</h2>
                            </div>
                        </div>
                        <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-[10px] font-black shadow-sm">XP {userProfile?.xp}</div>
                    </header>
                    <div className="bg-black dark:bg-zinc-900 text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <Sparkles className="absolute -right-6 -top-6 opacity-10 rotate-12" size={120} />
                        <h3 className="text-3xl font-black mb-1 leading-tight tracking-tighter">Hafıza Laboratuvarı</h3>
                        <p className="text-white/60 text-sm mb-8 font-medium">Becerilerini test etmek için hazır mısın?</p>
                        <div className="grid grid-cols-2 gap-4 relative z-10">
                             <button onClick={() => setView(AppView.STUDY)} className="bg-white text-black py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg">Kartları Çalış</button>
                             <button onClick={() => setView(AppView.VOICE_TALK)} className="bg-white/10 backdrop-blur-md text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 border border-white/10"><Mic size={14} /> Canlı Koç</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setView(AppView.COLLECTION)} className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-left active:scale-95 transition-all group">
                             <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform"><BookMarked size={20} /></div>
                             <h4 className="font-bold text-sm">Koleksiyon</h4>
                             {loadingWords ? <Shimmer className="h-2 w-12 mt-1" /> : <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{words.length} Kelime</p>}
                        </button>
                        <button onClick={() => setView(AppView.GAMES)} className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-left active:scale-95 transition-all group">
                             <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform"><Trophy size={20} /></div>
                             <h4 className="font-bold text-sm">Arena</h4>
                             <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Oyun & Rekabet</p>
                        </button>
                    </div>
                    <button onClick={() => setView(AppView.STUDIO)} className="w-full bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-purple-50 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-600"><Wand2 size={24} /></div>
                            <div className="text-left">
                                <h4 className="font-black text-lg">AI Atölye</h4>
                                <p className="text-xs text-zinc-400 font-medium">Hedefine özel içerikler tasarla.</p>
                            </div>
                        </div>
                        <ArrowRight size={20} className="text-zinc-300 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            )}
            {view === AppView.VOICE_TALK && <VoiceTalk userProfile={userProfile} recentWords={words.slice(0, 5)} onBack={() => setView(AppView.DASHBOARD)} onAddWords={handleAddWords} />}
            {view === AppView.DISCOVER && (
                <Discover 
                    userProfile={userProfile} 
                    words={words} 
                    needsDailyBatch={needsDailyBatch}
                    isGeneratingDaily={isGeneratingWords}
                    onGenerateDaily={handleGenerateDailyBatch}
                    onAddWord={(w) => handleAddWords([w])} 
                    onAddXP={handleAddXP}
                />
            )}
            {view === AppView.STUDIO && <Studio userLevel={userProfile?.level || 'A1'} onAddWords={handleAddWords} onAddXP={handleAddXP} />}
            {view === AppView.COLLECTION && <Collection words={words} userLevel={userProfile?.level || 'A1'} onBack={() => setView(AppView.DASHBOARD)} />}
            {view === AppView.GAMES && <Games words={words} userProfile={userProfile} onAddXP={handleAddXP} />}
            {view === AppView.PROFILE && <Profile userProfile={userProfile} words={words} onUpdateProfile={handleUpdateProfile} onSignOut={() => signOut(auth)} onOpenSettings={() => setView(AppView.SETTINGS)} />}
            {view === AppView.SETTINGS && <Settings userProfile={userProfile} words={words} onUpdateProfile={handleUpdateProfile} onBack={() => setView(AppView.PROFILE)} onClearData={() => {}} onSignOut={() => signOut(auth)} />}
            {view === AppView.STUDY && (
                <div className="h-full flex flex-col p-6 pt-12 animate-fade-in bg-zinc-50 dark:bg-zinc-950 transition-colors">
                     <header className="flex justify-between items-center mb-10">
                         <button onClick={() => setView(AppView.DASHBOARD)} className="p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-full shadow-sm active:scale-95 transition-transform"><ArrowLeft size={20} className="text-black dark:text-white"/></button>
                         <div className="flex flex-col items-center">
                            <span className="font-black text-[9px] uppercase tracking-widest text-zinc-400 mb-1">Öğrenim Seansı</span>
                            <div className="flex gap-1">
                                {[...Array(Math.min(dueWords.length, 5))].map((_, i) => <div key={i} className="w-4 h-1 rounded-full bg-indigo-500" />)}
                                {dueWords.length > 5 && <div className="w-4 h-1 rounded-full bg-zinc-200 dark:bg-zinc-800" />}
                            </div>
                         </div>
                         <div className="w-10"></div>
                     </header>
                     {dueWords.length > 0 ? (
                         <StudyCard 
                            word={dueWords[0]} 
                            mode={currentStudyMode} 
                            onResult={(grade) => updateSRS(dueWords[0], grade)} 
                            nextIntervals={{again:'10dk', hard:'1g', good:'4g', easy:'7g'}} 
                            autoPlayAudio={userProfile?.settings?.autoPlayAudio}
                         />
                     ) : (
                         <div className="flex-1 flex flex-col items-center justify-center text-center px-10 animate-slide-up">
                             <div className="w-32 h-32 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 mb-8 shadow-xl"><CheckCircle2 size={64} /></div>
                             <h3 className="text-4xl font-black mb-3 tracking-tighter">Harika İş!</h3>
                             <p className="text-zinc-500 font-medium text-sm leading-relaxed mb-10">Bugünlük tüm kelimelerini bitirdin.</p>
                             <button onClick={() => setView(AppView.DASHBOARD)} className="w-full bg-black dark:bg-white text-white dark:text-black py-5 rounded-[2rem] font-black shadow-2xl active:scale-95 transition-all text-lg">Dönüş Yap</button>
                         </div>
                     )}
                </div>
            )}
        </main>
        {generatedBatch && (
            <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-fade-in">
                <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[3rem] p-8 shadow-2xl border border-white/10 animate-slide-up max-h-[85vh] flex flex-col">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-500/20"><Check size={32} /></div>
                        <div>
                            <h3 className="text-2xl font-black text-black dark:text-white tracking-tighter">Yeni Kelimeler Hazır!</h3>
                            <p className="text-sm text-zinc-500 font-medium">Günlük setin koleksiyonuna eklendi.</p>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3 mb-8">
                        {generatedBatch.map((word, idx) => (
                            <div key={idx} className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-between group">
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-black text-black dark:text-white truncate">{word.term}</h4>
                                    <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">{word.translation}</p>
                                </div>
                                <span className="text-[9px] font-black text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded uppercase">{word.type}</span>
                            </div>
                        ))}
                    </div>
                    <div className="space-y-3">
                        <button onClick={() => { setGeneratedBatch(null); setView(AppView.STUDY); }} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm tracking-widest shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all"><BookOpen size={18} /> HEMEN ÇALIŞMAYA BAŞLA</button>
                        <button onClick={() => setGeneratedBatch(null)} className="w-full py-4 text-zinc-400 font-black text-xs uppercase tracking-widest hover:text-black dark:hover:text-white transition-colors">Daha Sonra</button>
                    </div>
                </div>
            </div>
        )}
        {view !== AppView.AUTH && view !== AppView.ONBOARDING && view !== AppView.VOICE_TALK && view !== AppView.STUDY && <Navigation currentView={view} setView={setView} />}
    </div>
  );
}
