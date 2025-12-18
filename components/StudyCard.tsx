
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Volume2, Sparkles, BookOpen, Lightbulb, Mic, Check, AlertCircle, Loader2, ImageIcon, Waves, X, Pencil, MessageCircle, Brain, Activity } from 'lucide-react';
import { UserWord, StudyMode } from '../types';
import { generateVisualMnemonic, correctUserSentence, generateAudio, playGeminiAudio } from '../services/geminiService';

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
    
    // Automatic Audio Playback
    if (autoPlayAudio) {
        setTimeout(() => speak(), 500);
    }
  }, [word.id]);

  const speak = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
        const utterance = new SpeechSynthesisUtterance(word.term);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    } catch (e) {} finally { setTimeout(() => setIsPlaying(false), 800); }
  };

  const handlePlayDefinitionAudio = async () => {
    if (isExplaining) return;
    setIsExplaining(true);
    try {
        const audioText = `${word.term} means ${word.definition}. For instance: ${word.exampleSentence}`;
        const base64 = await generateAudio(audioText);
        if (base64) {
            await playGeminiAudio(base64);
        }
    } catch (e) {} finally {
        setIsExplaining(false);
    }
  };

  const handleVisualHelp = async () => {
      if (visualMnemonic || isGeneratingVisual) return;
      setIsGeneratingVisual(true);
      try {
          const res = await generateVisualMnemonic(word.term, word.translation);
          setVisualMnemonic(res);
      } catch (e) {} finally { setIsGeneratingVisual(false); }
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
      } catch (e) {} finally { setIsChecking(false); }
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
    <div className="relative w-full max-w-[320px] aspect-[3/4.6] mx-auto flex flex-col bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] dark:shadow-black/50 border border-zinc-100 dark:border-zinc-800 overflow-hidden transition-all duration-500">
       
       {/* Scientific Header */}
       <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10">
           <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full">
               {mode === 'meaning' && <Sparkles size={10} className="text-indigo-500" />}
               {mode === 'writing' && <Pencil size={10} className="text-blue-500" />}
               {mode === 'context' && <MessageCircle size={10} className="text-emerald-500" />}
               <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{mode === 'meaning' ? word.type : mode}</span>
           </div>
           
           <div className="flex flex-col items-end gap-1">
               <div className="flex items-center gap-1.5">
                   <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Hafıza</span>
                   <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                       <div className={`h-full rounded-full transition-all duration-1000 ${retentionColor}`} style={{ width: `${retention}%` }}></div>
                   </div>
               </div>
               {retention < 30 && (
                   <span className="text-[9px] font-black text-red-500 animate-pulse">KRİTİK SEVİYE</span>
               )}
           </div>
       </div>

       {/* Front Face */}
       <div className={`flex-1 flex flex-col p-6 ${showAnswer ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'} transition-all duration-300`}>
           <div className="mt-12 mb-6 text-right">
                <button 
                    onClick={handleVisualHelp} 
                    className={`p-2 rounded-full border transition-all active:scale-90 ${visualMnemonic ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-zinc-200 dark:border-zinc-700 text-zinc-400'}`}
                >
                    {isGeneratingVisual ? <Loader2 size={16} className="animate-spin"/> : <ImageIcon size={16}/>}
                </button>
           </div>

           <div className="flex-1 flex flex-col items-center justify-center text-center">
                {mode === 'meaning' || mode === 'writing' ? (
                    <>
                        <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-4">HAFIZANI TEST ET</p>
                        <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-2 leading-tight">
                            {mode === 'writing' ? '???' : word.term}
                        </h2>
                        {mode !== 'writing' && (
                            <div className="inline-block px-3 py-0.5 rounded-full bg-zinc-50 dark:bg-zinc-800 text-[9px] font-mono text-zinc-400 mb-6 border border-zinc-100 dark:border-zinc-700">
                                /{word.pronunciation}/
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700 mb-6">
                        <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2">BAĞLAM</p>
                        <p className="text-sm italic font-serif leading-relaxed text-zinc-600 dark:text-zinc-300">
                            "{word.exampleSentence.replace(new RegExp(word.term, 'gi'), '_____')}"
                        </p>
                    </div>
                )}
                
                <button 
                    onClick={speak} 
                    className="w-14 h-14 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-50 dark:border-indigo-900/10 active:scale-90 transition-all"
                >
                    {isPlaying ? <Waves size={24} className="animate-pulse" /> : <Volume2 size={24} />}
                </button>
           </div>

           <div className="mt-6 space-y-3">
                {mode === 'writing' && (
                    <div className="relative">
                        <input 
                            value={userInput}
                            onChange={e => setUserInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && checkWriting()}
                            placeholder="Kelimeyi buraya yaz..."
                            className="w-full bg-zinc-100 dark:bg-zinc-800 p-4 rounded-2xl text-sm border-2 border-transparent focus:border-blue-500 outline-none font-bold text-center uppercase tracking-widest"
                        />
                    </div>
                )}

                {mode === 'meaning' && (
                    <div className="relative group">
                        <input 
                            value={userSentence}
                            onChange={e => setUserSentence(e.target.value)}
                            placeholder="Örnek cümle kur..."
                            className="w-full bg-zinc-50 dark:bg-zinc-800 p-4 rounded-2xl text-xs border-2 border-transparent focus:border-indigo-500 outline-none pr-12 font-medium shadow-inner transition-all"
                        />
                        <button 
                            onClick={handleSentenceCheck} 
                            disabled={isChecking} 
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl active:scale-90 transition-all disabled:opacity-50"
                        >
                            {isChecking ? <Loader2 size={14} className="animate-spin"/> : <Mic size={14}/>}
                        </button>
                    </div>
                )}

                {visualMnemonic && (
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl animate-slide-up">
                        <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest mb-1">AI İpucu</p>
                        <p className="text-xs italic text-indigo-900 dark:text-indigo-200 leading-tight font-medium">"{visualMnemonic}"</p>
                    </div>
                )}

                {sentenceFeedback && (
                    <div className={`p-3 rounded-xl text-[10px] font-bold flex items-center gap-2 animate-slide-up shadow-sm border ${sentenceFeedback.isCorrect ? 'bg-green-50 border-green-100 text-green-700' : 'bg-orange-50 border-orange-100 text-orange-700'}`}>
                        {sentenceFeedback.isCorrect ? <Check size={12}/> : <AlertCircle size={12}/>}
                        {sentenceFeedback.feedback}
                    </div>
                )}
           </div>

           <button 
                onClick={() => setShowAnswer(true)} 
                className="w-full bg-black dark:bg-white text-white dark:text-black py-4.5 rounded-2xl font-black text-sm shadow-xl mt-6 active:scale-[0.98] transition-all"
           >
                {mode === 'meaning' ? 'Cevabı Gör' : 'Kontrol Et & Gör'}
           </button>
       </div>

       {/* Back Face */}
       {showAnswer && (
           <div className="absolute inset-0 bg-white dark:bg-zinc-900 z-20 p-6 flex flex-col animate-slide-up overflow-hidden">
               <div className="flex-1 overflow-y-auto scrollbar-hide py-6 text-center">
                   <h2 className="text-4xl font-black text-black dark:text-white mb-1 tracking-tighter">{word.term}</h2>
                   <div className="text-2xl font-black text-indigo-600 mb-8">{word.translation}</div>
                   
                   <div className="space-y-3 text-left">
                       <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm relative group">
                           <div className="flex items-center justify-between mb-2">
                               <div className="flex items-center gap-2 text-zinc-400">
                                   <BookOpen size={12} />
                                   <p className="text-[9px] font-black uppercase tracking-widest">Açıklama</p>
                               </div>
                               <button 
                                   onClick={handlePlayDefinitionAudio}
                                   disabled={isExplaining}
                                   className="p-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100 active:scale-90 transition-all disabled:opacity-50"
                               >
                                   {isExplaining ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />}
                               </button>
                           </div>
                           <p className="text-xs font-medium leading-tight text-zinc-800 dark:text-zinc-200">"{word.definition}"</p>
                       </div>

                       <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                           <div className="flex items-center gap-2 mb-2 text-zinc-400">
                               <Lightbulb size={12} />
                               <p className="text-[9px] font-black uppercase tracking-widest">Cümle İçinde</p>
                           </div>
                           <p className="text-xs font-serif italic text-zinc-700 dark:text-zinc-300 leading-tight">"{word.exampleSentence}"</p>
                       </div>

                       {/* Scientific Insight Badge */}
                       <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex items-center gap-3">
                           <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600">
                               <Brain size={14} />
                           </div>
                           <div>
                               <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Bilimsel Görüş</p>
                               <p className="text-[10px] text-indigo-800 dark:text-indigo-200 font-bold leading-tight">
                                   {retention < 30 
                                     ? "Tam zamanında! Bu kelime silinmek üzereydi." 
                                     : "Hafızan güçlü. Tekrar aralığını uzatıyoruz."}
                               </p>
                           </div>
                       </div>
                   </div>
               </div>

               <div className="grid grid-cols-4 gap-1.5 pb-4 shrink-0 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    {[
                        { id: 'again', label: 'Tekrar', color: 'bg-red-50 text-red-600 border border-red-100', val: nextIntervals.again },
                        { id: 'hard', label: 'Zor', color: 'bg-zinc-50 text-zinc-500 border border-zinc-100', val: nextIntervals.hard },
                        { id: 'good', label: 'İyi', color: 'bg-indigo-600 text-white shadow-lg', val: nextIntervals.good },
                        { id: 'easy', label: 'Kolay', color: 'bg-emerald-500 text-white shadow-lg', val: nextIntervals.easy }
                    ].map(g => (
                        <button key={g.id} onClick={() => onResult(g.id as any)} className={`p-3 rounded-xl flex flex-col items-center justify-center active:scale-90 transition-all ${g.color}`}>
                            <span className="text-[10px] font-black">{g.label}</span>
                            <span className="text-[8px] opacity-60 uppercase tracking-widest mt-0.5">{g.val}</span>
                        </button>
                    ))}
               </div>
           </div>
       )}
    </div>
  );
};
