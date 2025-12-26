
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { UserWord, AppView, SRSState, UserProfile, StudyMode, UserLevel, UserGoal, GeneratedStory, LeaderboardEntry, WordData, ChatMessage, SRSHistoryItem, Quest } from './types';
import { generateDailyBatch, generateAudio, playGeminiAudio, generateContextualStory, generateSingleWord, generateRoleplayResponse, generatePhrasalVerbBatch } from './services/geminiService';
import { auth, db } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, writeBatch, enableIndexedDbPersistence, query, orderBy, limit, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { Shimmer } from './components/Shimmer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer, toast } from './components/Toast';


import { AdService, adService } from './services/adService';
import { Capacitor } from '@capacitor/core';

// Lazy Load Components
const Navigation = React.lazy(() => import('./components/Navigation').then(module => ({ default: module.Navigation })));
const StudyCard = React.lazy(() => import('./components/StudyCard').then(module => ({ default: module.StudyCard })));
const Onboarding = React.lazy(() => import('./components/Onboarding').then(module => ({ default: module.Onboarding })));
const Games = React.lazy(() => import('./components/Games').then(module => ({ default: module.Games })));
const Settings = React.lazy(() => import('./components/Settings').then(module => ({ default: module.Settings })));
const Auth = React.lazy(() => import('./components/Auth').then(module => ({ default: module.Auth })));
const VoiceTalk = React.lazy(() => import('./components/VoiceTalk').then(module => ({ default: module.VoiceTalk })));
const Collection = React.lazy(() => import('./components/Collection').then(module => ({ default: module.Collection })));
const Discover = React.lazy(() => import('./components/Discover').then(module => ({ default: module.Discover })));
const Studio = React.lazy(() => import('./components/Studio').then(module => ({ default: module.Studio })));
const Profile = React.lazy(() => import('./components/Profile').then(module => ({ default: module.Profile })));

import { Sparkles, Zap, Layers, Volume2, Settings as SettingsIcon, ArrowLeft, Trophy, Target, CheckCircle2, MoreHorizontal, BookOpen, Search, ArrowRight, Flame, BrainCircuit, Play, Edit2, X, Send, MessageSquare, Loader2, Snowflake, Mic, BookMarked, BarChart3, Camera, Wand2, Plus, Command, Check, Brain, Activity } from 'lucide-react';

import { useApp } from './context/AppContext';

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
    const {
        userProfile, words, leaderboardData, loading, view, setView,
        updateProfile, addWords, addXP, updateQuestProgress, clearData,
        dueWords, needsDailyBatch, currentStudyMode, setCurrentStudyMode, handleSRSUpdate
    } = useApp();

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
        if (Capacitor.isNativePlatform()) {
            const showViews = [AppView.DASHBOARD, AppView.COLLECTION, AppView.GAMES, AppView.DISCOVER, AppView.PROFILE];
            if (showViews.includes(view)) {
                adService.showBanner();
            } else {
                adService.hideBanner();
            }
        }
    }, [view]);

    const handleGenerateBatch = async () => {
        if (!userProfile || isGeneratingWords) return;
        setIsGeneratingWords(true);
        try {
            const existingTerms = words.map(w => w.term);
            const newWords = await generateDailyBatch(userProfile.dailyTarget, userProfile.level, userProfile.goal, existingTerms);
            await addWords(newWords);
            updateProfile('lastGeneratedDate', new Date().toDateString());
            addXP(50);
            setGeneratedBatch(newWords);
            toast.success(`${newWords.length} yeni kelime eklendi!`);
        } catch (e) {
            console.error(e);
            toast.error('Günlük kelimeler üretilemedi. Lütfen tekrar deneyin.');
        } finally {
            setIsGeneratingWords(false);
        }
    };

    const memoryHealth = useMemo(() => {
        if (words.length === 0) return 0;
        let totalScore = 0;
        words.forEach(w => {
            let score = 0;
            if (w.srs.interval > 30) score = 100;
            else if (w.srs.interval > 14) score = 90;
            else if (w.srs.interval > 7) score = 75;
            else if (w.srs.interval > 3) score = 50;
            else if (w.srs.interval > 0) score = 30;
            else score = 10;

            // Penalty for overdue
            if (w.srs.nextReview < Date.now()) {
                const overdueDays = (Date.now() - w.srs.nextReview) / (24 * 60 * 60 * 1000);
                score = Math.max(0, score - (overdueDays * 10));
            }
            totalScore += score;
        });
        if (words.length === 0) return 0;
        return Math.round(totalScore / words.length);
    }, [words]);

    if (loading) return (
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
        <ErrorBoundary>
            <ToastContainer />
            <div className="h-[100dvh] w-full bg-zinc-50 dark:bg-zinc-950 text-black dark:text-white font-sans overflow-hidden flex flex-col transition-colors duration-500">
                <main className="flex-1 w-full overflow-hidden relative">
                    <Suspense fallback={<div className="h-full w-full flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>}>
                        {view === AppView.AUTH && <Auth onLoginSuccess={() => { }} />}
                        {view === AppView.ONBOARDING && <Onboarding onComplete={(p) => updateProfile('hasCompletedOnboarding', true)} />}
                        {view === AppView.DASHBOARD && (
                            <div
                                className="h-full overflow-y-auto p-6 space-y-6 max-w-md mx-auto scrollbar-hide animate-fade-in pb-32"
                                style={{ paddingTop: Capacitor.isNativePlatform() ? 'calc(6rem + var(--sat))' : 'calc(3rem + var(--sat))' }}
                            >
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

                                {/* Scientific Memory Health Widget */}
                                <div className="bg-gradient-to-br from-zinc-900 to-black dark:from-zinc-800 dark:to-zinc-950 text-white p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden border border-zinc-800">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
                                    <div className="relative z-10 flex justify-between items-center">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Brain size={18} className="text-indigo-400" />
                                                <h3 className="text-sm font-black text-indigo-200 uppercase tracking-widest">Hafıza Sağlığı</h3>
                                            </div>
                                            <div className="text-5xl font-black tracking-tighter mb-2">%{memoryHealth}</div>
                                            <p className="text-[10px] text-zinc-400 font-medium max-w-[160px] leading-relaxed">
                                                Bilimsel aralıklarla tekrar yaparak bu oranı %100'e yaklaştır.
                                            </p>
                                        </div>
                                        <div className="relative w-24 h-24 flex items-center justify-center">
                                            <svg className="w-full h-full -rotate-90">
                                                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-zinc-800" />
                                                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-indigo-500 transition-all duration-1000 ease-out" strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={`${2 * Math.PI * 40 * (1 - memoryHealth / 100)}`} strokeLinecap="round" />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Activity size={24} className="text-white" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-black dark:bg-zinc-900 text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <Sparkles className="absolute -right-6 -top-6 opacity-10 rotate-12" size={120} />
                                    <h3 className="text-3xl font-black mb-1 leading-tight tracking-tighter">Hafıza Laboratuvarı</h3>
                                    <p className="text-white/60 text-sm mb-8 font-medium">Becerilerini test etmek için hazır mısın?</p>
                                    <div className="grid grid-cols-2 gap-4 relative z-10">
                                        <button onClick={() => setView(AppView.STUDY)} className="bg-white text-black py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg">Kartları Çalış</button>
                                        <button onClick={() => {
                                            if (needsDailyBatch) handleGenerateBatch();
                                            else setView(AppView.STUDY);
                                        }} className="bg-indigo-600 text-white font-black py-4 rounded-3xl shadow-xl shadow-indigo-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                                            {isGeneratingWords ? <Loader2 className="animate-spin" size={16} /> : (needsDailyBatch ? <Zap size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />)}
                                            {isGeneratingWords ? 'Hazırlanıyor...' : (needsDailyBatch ? 'Günlük Kelimeleri Üret' : 'Çalışmaya Başla')}
                                        </button>
                                    </div>
                                </div>

                                {words.length === 0 && (
                                    <div className="bg-indigo-600/10 border border-indigo-500/20 p-8 rounded-[2.5rem] text-center animate-pulse">
                                        <Sparkles size={40} className="text-indigo-500 mx-auto mb-4" />
                                        <h4 className="font-black text-lg mb-2">Hadi Başlayalım!</h4>
                                        <p className="text-xs text-zinc-500 mb-6">Henüz kelime eklememişsin. Keşfet sekmesine giderek ilk kelimelerini ekleyebilirsin.</p>
                                        <button onClick={() => setView(AppView.DISCOVER)} className="bg-indigo-600 text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
                                            KELİME KEŞFET
                                        </button>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <button onClick={() => {
                                        if (Math.random() > 0.4) adService.showInterstitial();
                                        setView(AppView.COLLECTION);
                                    }} className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-left active:scale-95 transition-all group">
                                        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform"><BookMarked size={20} /></div>
                                        <h4 className="font-bold text-sm">Koleksiyon</h4>
                                        {loading ? <Shimmer className="h-2 w-12 mt-1" /> : <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{words.length} Kelime</p>}
                                    </button>
                                    <button onClick={() => {
                                        if (Math.random() > 0.4) adService.showInterstitial();
                                        setView(AppView.GAMES);
                                    }} className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-left active:scale-95 transition-all group">
                                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform"><Trophy size={20} /></div>
                                        <h4 className="font-bold text-sm">Arena</h4>
                                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Oyun & Rekabet</p>
                                    </button>
                                </div>
                                <button onClick={() => {
                                    if (Math.random() > 0.4) adService.showInterstitial();
                                    setView(AppView.STUDIO);
                                }} className="w-full bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all">
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
                        {view === AppView.VOICE_TALK && <VoiceTalk userProfile={userProfile} recentWords={words.slice(0, 5)} onBack={() => setView(AppView.DASHBOARD)} onAddWords={addWords} />}
                        {view === AppView.DISCOVER && (
                            <Discover
                                userProfile={userProfile}
                                words={words}
                                needsDailyBatch={needsDailyBatch}
                                isGeneratingDaily={isGeneratingWords}
                                onGenerateDaily={handleGenerateBatch}
                                onAddWord={(w) => addWords([w])}
                                onAddXP={addXP}
                            />
                        )}
                        {view === AppView.STUDIO && <Studio userLevel={userProfile?.level || 'A1'} onAddWords={addWords} onAddXP={addXP} />}
                        {view === AppView.COLLECTION && <Collection words={words} userLevel={userProfile?.level || 'A1'} onBack={() => setView(AppView.DASHBOARD)} />}
                        {view === AppView.GAMES && <Games words={words} userProfile={userProfile} onAddXP={(xp) => { addXP(xp); updateQuestProgress('play_games', 1); }} leaderboardData={leaderboardData} />}
                        {view === AppView.PROFILE && <Profile userProfile={userProfile} words={words} onUpdateProfile={updateProfile} onSignOut={() => signOut(auth)} onOpenSettings={() => setView(AppView.SETTINGS)} />}
                        {view === AppView.SETTINGS && <Settings userProfile={userProfile} words={words} onUpdateProfile={updateProfile} onBack={() => setView(AppView.PROFILE)} onClearData={clearData} onSignOut={() => signOut(auth)} />}
                        {view === AppView.STUDY && (
                            <div className="h-full flex flex-col p-6 pt-12 animate-fade-in bg-zinc-50 dark:bg-zinc-950 transition-colors">
                                <header className="flex justify-between items-center mb-10">
                                    <button onClick={() => setView(AppView.DASHBOARD)} className="p-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-full shadow-sm active:scale-95 transition-transform"><ArrowLeft size={20} className="text-black dark:text-white" /></button>
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
                                        onResult={(grade) => handleSRSUpdate(dueWords[0], grade)}
                                        nextIntervals={{ again: '10dk', hard: '1g', good: '4g', easy: '7g' }}
                                        autoPlayAudio={userProfile?.settings?.autoPlayAudio}
                                    />
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center px-10 animate-slide-up">
                                        <div className="w-32 h-32 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 mb-8 shadow-xl"><CheckCircle2 size={64} /></div>
                                        <h3 className="text-4xl font-black mb-3 tracking-tighter">Harika İş!</h3>
                                        <p className="text-zinc-500 font-medium text-sm leading-relaxed mb-10">Bugünlük tüm kelimelerini bitirdin.</p>
                                        <button onClick={() => {
                                            setView(AppView.DASHBOARD);
                                            if (Math.random() > 0.5) { // Show interstitial 50% of the time on session finish
                                                adService.showInterstitial();
                                            }
                                        }} className="w-full bg-black dark:bg-white text-white dark:text-black py-5 rounded-[2rem] font-black shadow-2xl active:scale-95 transition-all text-lg">Dönüş Yap</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </Suspense>
                </main>
                {
                    generatedBatch && (
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
                    )
                }
                {
                    view !== AppView.AUTH && view !== AppView.ONBOARDING && view !== AppView.VOICE_TALK && view !== AppView.STUDY && (
                        <Suspense fallback={null}>
                            <Navigation currentView={view} setView={setView} />
                        </Suspense>
                    )
                }
            </div >
        </ErrorBoundary>
    );
}
