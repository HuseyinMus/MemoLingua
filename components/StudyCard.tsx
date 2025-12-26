
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Volume2, Sparkles, BookOpen, Lightbulb, Mic, Check, AlertCircle, Loader2, ImageIcon, Waves, X, Pencil, MessageCircle, Brain, Activity } from 'lucide-react';
import { UserWord, StudyMode, WordData } from '../types';
import { generateVisualMnemonic, correctUserSentence, generateAudio, playGeminiAudio } from '../services/geminiService';
import { audioManager } from '../services/audioManager';

interface StudyCardProps {
    word: UserWord;
    mode: StudyMode;
    onResult: (grade: 'again' | 'hard' | 'good' | 'easy') => void;
    nextIntervals: {
        again: string;
        hard: string;
        good: string;
        easy: string;
    };
    autoPlayAudio?: boolean;
}

export const StudyCard: React.FC<StudyCardProps> = ({ word, mode, onResult, nextIntervals, autoPlayAudio = true }) => {
    const [showAnswer, setShowAnswer] = useState(false);
    const [userSentence, setUserSentence] = useState('');
    const [userInput, setUserInput] = useState('');
    const [sentenceFeedback, setSentenceFeedback] = useState<{ isCorrect: boolean, feedback: string } | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [visualMnemonic, setVisualMnemonic] = useState<string | null>(null);
    const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isExplaining, setIsExplaining] = useState(false);
    const audioPlayedRef = useRef(false);

    useEffect(() => {
        setShowAnswer(false);
        setUserSentence('');
        setUserInput('');
        setSentenceFeedback(null);
        setVisualMnemonic(null);
        audioPlayedRef.current = false;
    }, [word.id]);

    useEffect(() => {
        // Automatic Audio Playback with reduced delay for better responsiveness
        if (autoPlayAudio && !audioPlayedRef.current) {
            const timer = setTimeout(() => {
                speak().catch(err => {
                    console.warn('Auto-play failed:', err);
                });
            }, 300); // Reduced from 800ms to 300ms for faster feedback

            return () => clearTimeout(timer);
        }
    }, [word.id, autoPlayAudio]);

    const speak = async () => {
        if (isPlaying) return;
        setIsPlaying(true);
        try {
            await audioManager.speak(word.term);
            audioPlayedRef.current = true;
        } finally {
            setIsPlaying(false);
        }
    };

    const handlePlayDefinitionAudio = async () => {
        if (isExplaining) return;
        setIsExplaining(true);
        try {
            const audioText = `${word.term} means ${word.definition}. For instance: ${word.exampleSentence}`;
            await audioManager.speak(audioText, { rate: 0.85, timeout: 5000 });
        } finally {
            setIsExplaining(false);
        }
    };

    const handleVisualHelp = async () => {
        if (visualMnemonic || isGeneratingVisual) return;
        setIsGeneratingVisual(true);
        try {
            const res = await generateVisualMnemonic(word.term, word.translation);
            setVisualMnemonic(res);
        } catch (e) { } finally { setIsGeneratingVisual(false); }
    };

    const checkWriting = () => {
        if (userInput.toLowerCase().trim() === word.term.toLowerCase().trim()) {
            setSentenceFeedback({ isCorrect: true, feedback: 'Harika! Doğru yazdın.' });
            setShowAnswer(true);
        } else {
            setSentenceFeedback({ isCorrect: false, feedback: 'Hatalı yazım, tekrar dene.' });
        }
    };

    const handleSentenceCheck = async () => {
        if (!userSentence.trim() || isChecking) return;
        setIsChecking(true);
        try {
            const res = await correctUserSentence(word.term, userSentence);
            setSentenceFeedback(res);
            if (res.isCorrect) speak();
        } catch (e) { } finally { setIsChecking(false); }
    };

    // Scientific Retention Calculation
    const retention = useMemo(() => {
        if (word.srs.interval === 0) return 0; // New
        const dayMs = 24 * 60 * 60 * 1000;
        const intervalMs = word.srs.interval * dayMs;
        const reviewTime = word.srs.nextReview;
        const lastReviewTime = reviewTime - intervalMs;
        const elapsed = Date.now() - lastReviewTime;

        // Linear approximation: 100% -> 0% over 1.5x interval
        const percentage = Math.max(0, 100 - ((elapsed / (intervalMs * 1.5)) * 100));
        return Math.min(100, Math.round(percentage));
    }, [word]);

    const retentionColor = retention > 70 ? 'bg-green-500' : retention > 40 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="relative w-full h-full max-h-[600px] flex flex-col bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">

            {/* Scientific Header */}
            <div className="shrink-0 p-6 flex justify-between items-start z-10 bg-gradient-to-b from-white via-white to-transparent dark:from-zinc-900 dark:via-zinc-900">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                    {mode === 'meaning' && <Sparkles size={12} className="text-indigo-500" />}
                    {mode === 'writing' && <Pencil size={12} className="text-blue-500" />}
                    {mode === 'context' && <MessageCircle size={12} className="text-emerald-500" />}
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{mode === 'meaning' ? word.type : mode}</span>
                </div>

                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Hafıza</span>
                        <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-1000 ${retentionColor}`} style={{ width: `${retention}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Front Face */}
            <div className={`flex-1 flex flex-col px-6 pb-6 overflow-y-auto ${showAnswer ? 'hidden' : 'flex'} transition-all duration-300`}>
                <div className="flex justify-end mb-4">
                    <button
                        onClick={handleVisualHelp}
                        className={`p-3 rounded-full border transition-all active:scale-90 ${visualMnemonic ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-zinc-200 dark:border-zinc-700 text-zinc-400'}`}
                    >
                        {isGeneratingVisual ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
                    </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center text-center -mt-10">
                    {mode === 'meaning' || mode === 'writing' ? (
                        <>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-6">HAFIZANI TEST ET</p>
                            <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-4 leading-tight break-words w-full">
                                {mode === 'writing' ? (
                                    <div className="flex flex-col gap-2">
                                        <span className="text-indigo-600 dark:text-indigo-400">{word.translation}</span>
                                        <span className="text-sm font-medium text-zinc-400 lowercase font-sans">({word.type})</span>
                                    </div>
                                ) : word.term}
                            </h2>
                            {mode !== 'writing' && (
                                <div className="inline-block px-4 py-1 rounded-full bg-zinc-50 dark:bg-zinc-800 text-xs font-mono text-zinc-500 mb-8 border border-zinc-100 dark:border-zinc-700">
                                    /{word.pronunciation}/
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-zinc-50 dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-700 mb-8 w-full">
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-3">BAĞLAM</p>
                            <p className="text-lg italic font-serif leading-relaxed text-zinc-700 dark:text-zinc-200">
                                "{word.exampleSentence.replace(new RegExp(word.term, 'gi'), '_____')}"
                            </p>
                        </div>
                    )}

                    <button
                        onClick={speak}
                        className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-zinc-800 flex items-center justify-center text-indigo-600 shadow-lg shadow-indigo-500/10 border-2 border-indigo-100 dark:border-zinc-700 active:scale-90 transition-all group"
                    >
                        {isPlaying ? <Waves size={32} className="animate-pulse" /> : <Volume2 size={32} className="group-hover:scale-110 transition-transform" />}
                    </button>
                </div>

                <div className="mt-auto space-y-4 pt-6">
                    {mode === 'writing' && (
                        <div className="relative">
                            <input
                                value={userInput}
                                onChange={e => setUserInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && checkWriting()}
                                placeholder="Kelimeyi buraya yaz..."
                                className="w-full bg-zinc-100 dark:bg-zinc-800 p-5 rounded-2xl text-lg border-2 border-transparent focus:border-blue-500 outline-none font-bold text-center uppercase tracking-widest"
                            />
                        </div>
                    )}

                    {mode === 'meaning' && (
                        <div className="relative group">
                            <input
                                value={userSentence}
                                onChange={e => setUserSentence(e.target.value)}
                                placeholder="Örnek cümle kur (isteğe bağlı)..."
                                className="w-full bg-zinc-50 dark:bg-zinc-800 p-5 rounded-2xl text-sm border-2 border-transparent focus:border-indigo-500 outline-none pr-14 font-medium shadow-sm transition-all"
                            />
                            <button
                                onClick={handleSentenceCheck}
                                disabled={isChecking}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-black dark:bg-white text-white dark:text-black rounded-xl active:scale-90 transition-all disabled:opacity-50"
                            >
                                {isChecking ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
                            </button>
                        </div>
                    )}

                    {visualMnemonic && (
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl animate-slide-up">
                            <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest mb-1.5">AI İpucu</p>
                            <p className="text-sm italic text-indigo-900 dark:text-indigo-200 leading-tight font-medium">"{visualMnemonic}"</p>
                        </div>
                    )}

                    {sentenceFeedback && (
                        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-3 animate-slide-up shadow-sm border ${sentenceFeedback.isCorrect ? 'bg-green-50 border-green-100 text-green-700' : 'bg-orange-50 border-orange-100 text-orange-700'}`}>
                            {sentenceFeedback.isCorrect ? <Check size={16} /> : <AlertCircle size={16} />}
                            {sentenceFeedback.feedback}
                        </div>
                    )}

                    <button
                        onClick={() => setShowAnswer(true)}
                        className="w-full bg-black dark:bg-white text-white dark:text-black py-5 rounded-[1.5rem] font-black text-base uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all"
                    >
                        {mode === 'meaning' ? 'Cevabı Gör' : 'Kontrol Et'}
                    </button>
                </div>
            </div>

            {/* Back Face */}
            {showAnswer && (
                <div className="flex-1 flex flex-col p-6 animate-slide-up overflow-hidden bg-white dark:bg-zinc-900">
                    <div className="flex-1 overflow-y-auto scrollbar-hide text-center pb-4">
                        <h2 className="text-5xl font-black text-black dark:text-white mb-2 tracking-tighter">{word.term}</h2>
                        <div className="text-3xl font-black text-indigo-600 mb-8">{word.translation}</div>

                        <div className="space-y-4 text-left">
                            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm relative group">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <BookOpen size={14} />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Açıklama</p>
                                    </div>
                                    <button
                                        onClick={handlePlayDefinitionAudio}
                                        disabled={isExplaining}
                                        className="p-2 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100 active:scale-90 transition-all disabled:opacity-50"
                                    >
                                        {isExplaining ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                                    </button>
                                </div>
                                <p className="text-sm font-medium leading-relaxed text-zinc-800 dark:text-zinc-200">"{word.definition}"</p>
                            </div>

                            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                <div className="flex items-center gap-2 mb-3 text-zinc-400">
                                    <Lightbulb size={14} />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Cümle İçinde</p>
                                </div>
                                <p className="text-sm font-serif italic text-zinc-700 dark:text-zinc-300 leading-relaxed">"{word.exampleSentence}"</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
                        {[
                            { id: 'again', label: 'Tekrar', color: 'bg-red-50 text-red-600 border border-red-100', val: nextIntervals.again },
                            { id: 'hard', label: 'Zor', color: 'bg-zinc-50 text-zinc-500 border border-zinc-100', val: nextIntervals.hard },
                            { id: 'good', label: 'İyi', color: 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30', val: nextIntervals.good },
                            { id: 'easy', label: 'Kolay', color: 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30', val: nextIntervals.easy }
                        ].map(g => (
                            <button key={g.id} onClick={() => onResult(g.id as any)} className={`p-4 rounded-2xl flex flex-col items-center justify-center active:scale-90 transition-all ${g.color}`}>
                                <span className="text-[11px] font-black uppercase tracking-wider">{g.label}</span>
                                <span className="text-[9px] opacity-70 mt-1 font-medium">{g.val}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
