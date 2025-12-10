



import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Eye, ArrowRight, Lightbulb, Keyboard, Waves, AlertCircle, X, Check, Mic, MicOff, BrainCircuit, Loader2 } from 'lucide-react';
import { UserWord, SRSState, StudyMode } from '../types';
import { playGeminiAudio, generateMnemonic } from '../services/geminiService';

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
  onUpdateSRS: (newSRS: SRSState) => void;
}

// Interactive Word Component for Context Mode
interface InteractiveWordProps {
    text: string;
    translation: string;
    type: string;
    isAdded?: boolean;
    onAdd?: () => void;
}

const InteractiveWord: React.FC<InteractiveWordProps> = ({ text, translation, type, isAdded = true, onAdd }) => {
    const [showTip, setShowTip] = useState(false);
    
    return (
        <span 
            className="relative inline-block"
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
            onClick={(e) => { e.stopPropagation(); setShowTip(!showTip); }}
        >
            <span className="font-bold text-black bg-yellow-100 px-1 py-0.5 rounded cursor-help border-b-2 border-yellow-300 transition-colors hover:bg-yellow-200 text-lg">
                {text}
            </span>
            
            {showTip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-900 text-white text-xs rounded-xl shadow-xl whitespace-nowrap z-50 flex flex-col items-center gap-1 min-w-[100px] animate-fade-in">
                    <div className="text-center">
                        <span className="font-bold text-sm block">{translation}</span>
                        <span className="text-[10px] opacity-70 uppercase tracking-widest block font-medium">{type}</span>
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-900"></div>
                </div>
            )}
        </span>
    );
};

// Animated Audio Visualizer Component
const AudioVisualizer = ({ isListening }: { isListening: boolean }) => {
    return (
        <div className="flex items-center justify-center gap-1 h-12">
            {[1, 2, 3, 4, 5].map((i) => (
                <div 
                    key={i}
                    className={`w-1.5 bg-black dark:bg-white rounded-full transition-all duration-300 ${
                        isListening ? 'animate-pulse' : 'h-1.5 opacity-10'
                    }`}
                    style={{ 
                        height: isListening ? `${Math.max(10, Math.random() * 100)}%` : '6px',
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '0.6s'
                    }}
                />
            ))}
        </div>
    );
};

// Logic Helpers
const normalizeText = (text: string) => {
    return text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").trim();
};

const getLevenshteinDistance = (a: string, b: string) => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const calculateScore = (target: string, spoken: string) => {
    const cleanTarget = normalizeText(target);
    const cleanSpoken = normalizeText(spoken);
    
    if (cleanTarget === cleanSpoken) return 100;
    if (!cleanSpoken) return 0;
    
    const distance = getLevenshteinDistance(cleanTarget, cleanSpoken);
    const maxLength = Math.max(cleanTarget.length, cleanSpoken.length);
    const score = Math.max(0, ((maxLength - distance) / maxLength) * 100);
    return Math.round(score);
};

const formatDate = (ts: number) => new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

export const StudyCard: React.FC<StudyCardProps> = ({ word, mode, onResult, nextIntervals, onUpdateSRS }) => {
  const [showAnswer, setShowAnswer] = useState(false);
  const [input, setInput] = useState('');
  const [showFeedback, setShowFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [hintLevel, setHintLevel] = useState(0); 
  const [incorrectAttempts, setIncorrectAttempts] = useState(0);
  const [isContextRevealed, setIsContextRevealed] = useState(false);
  
  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mnemonic State
  const [mnemonic, setMnemonic] = useState<string | null>(word.mnemonic || null);
  const [isLoadingMnemonic, setIsLoadingMnemonic] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);

  // Speaking Mode State
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [pronunciationScore, setPronunciationScore] = useState<number>(0);
  const recognitionRef = useRef<any>(null);

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          if (recognitionRef.current) {
              try {
                  recognitionRef.current.abort();
                  recognitionRef.current = null;
              } catch (e) {
                  // ignore
              }
          }
      };
  }, []);

  useEffect(() => {
    setShowAnswer(false);
    setInput('');
    setShowFeedback(null);
    setIsShaking(false);
    setHintLevel(0);
    setIncorrectAttempts(0);
    setIsContextRevealed(false);
    setAudioError(false);
    setIsPlaying(false);
    setIsListening(false);
    setSpokenText('');
    setPermissionDenied(false);
    setPronunciationScore(0);
    setShowMnemonic(false);
    
    // Check if mnemonic is already loaded in word data
    setMnemonic(word.mnemonic || null);
    
    if (mode === 'speaking') {
         const hasSupport = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
         setIsSpeechSupported(hasSupport);
    }
    
    if (mode === 'writing' || mode === 'context' || mode === 'translation') {
        setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [word.id, mode]); 

  const speak = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isPlaying) return;

    setIsPlaying(true);
    setAudioError(false);

    try {
        if (word.audioBase64) {
            await playGeminiAudio(word.audioBase64);
        } else {
            throw new Error("No AI audio available");
        }
    } catch (err) {
        console.warn("Falling back to browser TTS due to error:", err);
        setAudioError(true);
        const utterance = new SpeechSynthesisUtterance(word.term);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
        setTimeout(() => setAudioError(false), 3000);
    } finally {
        setTimeout(() => setIsPlaying(false), 1500);
    }
  };

  const handleFetchMnemonic = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (showMnemonic) {
          setShowMnemonic(false);
          return;
      }
      
      if (mnemonic) {
          setShowMnemonic(true);
          return;
      }

      setIsLoadingMnemonic(true);
      try {
          const hint = await generateMnemonic(word.term, word.definition, word.translation);
          setMnemonic(hint);
          setShowMnemonic(true);
      } catch (e) {
          console.error("Failed to get hint", e);
      } finally {
          setIsLoadingMnemonic(false);
      }
  };

  const startListening = () => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
          setIsSpeechSupported(false);
          return;
      }

      setPermissionDenied(false);
      setIsListening(true);
      setSpokenText('');
      setShowFeedback(null);
      setPronunciationScore(0);
      
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
          setIsListening(true);
      };

      recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setSpokenText(transcript);
          
          const score = calculateScore(word.term, transcript);
          setPronunciationScore(score);

          if (score >= 85) {
              setPronunciationScore(100);
              setShowFeedback('correct');
          } else {
              setShowFeedback('incorrect');
              setIsShaking(true);
              setIncorrectAttempts(prev => prev + 1);
              setTimeout(() => setIsShaking(false), 500);
          }
          setIsListening(false);
      };

      recognition.onerror = (event: any) => {
          console.error("Speech Recognition Error:", event.error);
          setIsListening(false);
          if (event.error === 'not-allowed' || event.error === 'permission-denied') {
              setPermissionDenied(true);
          }
          if (event.error === 'no-speech') {
             setSpokenText('');
          }
      };
      
      recognition.onend = () => {
          setIsListening(false);
      };

      try {
        recognition.start();
      } catch (e) {
          console.error("Failed to start recognition", e);
      }
  };

  const retrySpeaking = () => {
      setSpokenText('');
      setShowFeedback(null);
      startListening();
  };

  const handleWritingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showAnswer) return;

    const cleanInput = input.trim().toLowerCase();
    const cleanTerm = word.term.trim().toLowerCase();
    
    if (cleanInput === cleanTerm) {
      setShowFeedback('correct');
      speak(); 
      setTimeout(() => setShowAnswer(true), 800);
    } else {
      setShowFeedback('incorrect');
      setIsShaking(true);
      setIncorrectAttempts(prev => prev + 1);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const handleTranslationSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (showAnswer) return;

      const cleanInput = input.trim().toLocaleLowerCase('tr');
      const cleanTranslation = word.translation.toLocaleLowerCase('tr');

      if (cleanTranslation.includes(cleanInput) && cleanInput.length > 2) {
          setShowFeedback('correct');
          speak();
          setTimeout(() => setShowAnswer(true), 800);
      } else {
          setShowFeedback('incorrect');
          setIsShaking(true);
          setIncorrectAttempts(prev => prev + 1);
          setTimeout(() => setIsShaking(false), 500);
      }
  };

  const handleReveal = () => {
    setShowAnswer(true);
    speak();
  };

  const showHint = () => {
    setHintLevel(prev => Math.min(prev + 1, word.term.length));
    inputRef.current?.focus();
  };

  const getPhaseLabel = () => {
      switch(mode) {
          case 'meaning': return { label: 'Anlamı Ne?', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-300' };
          case 'translation': return { label: 'Çeviri', bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-300' };
          case 'context': return { label: 'Boşluğu Doldur', bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-300' };
          case 'writing': return { label: 'Yazma', bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-300' };
          case 'speaking': return { label: 'Telaffuz', bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-300' };
          default: return { label: 'Tekrar', bg: 'bg-zinc-100', text: 'text-zinc-500' };
      }
  };

  const phase = getPhaseLabel();

  const renderPronunciationFeedback = () => {
      if (!spokenText) return null;
      
      const targetChars = word.term.split('');
      const spokenClean = normalizeText(spokenText);
      const isPerfect = pronunciationScore === 100;
      
      return (
          <div className="flex flex-col items-center gap-4 animate-fade-in w-full">
             {/* Comparison Card */}
             <div 
                onClick={speak} 
                className="cursor-pointer group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 w-full text-center hover:border-black dark:hover:border-white transition-all shadow-sm"
             >
                 <div className="mb-2">
                     <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Target</p>
                     <div className="flex justify-center flex-wrap gap-0.5 font-mono text-2xl font-black tracking-widest">
                        {targetChars.map((char, i) => {
                            const spokenChar = spokenClean[i];
                            const isMatch = spokenChar && spokenChar.toLowerCase() === char.toLowerCase();
                            
                            let className = "text-green-500"; 
                            if (!spokenChar) {
                                className = "text-zinc-300 dark:text-zinc-700 opacity-50"; 
                            } else if (!isMatch) {
                                className = "text-red-500"; 
                            }
                            
                            return <span key={i} className={className}>{char}</span>;
                        })}
                     </div>
                 </div>

                 {!isPerfect && (
                     <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Duyulan</p>
                        <p className="text-lg text-zinc-600 dark:text-zinc-300 font-medium italic">"{spokenText}"</p>
                     </div>
                 )}
             </div>
             <div className="text-center">
                 <span className={`text-2xl font-black ${isPerfect ? 'text-green-600 dark:text-green-400' : 'text-orange-500'}`}>
                    {pronunciationScore}%
                 </span>
                 <span className="text-[10px] block font-bold uppercase text-zinc-400 tracking-wider">Doğruluk</span>
             </div>
          </div>
      );
  };

  const renderInteractiveSentence = () => {
      return (
        <p className="text-lg md:text-xl font-serif font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">
            {word.exampleSentence.split(new RegExp(`(${word.term})`, 'gi')).map((part, i) => {
                if (part.toLowerCase() === word.term.toLowerCase()) {
                    return <InteractiveWord key={i} text={part} translation={word.translation} type={word.type} isAdded={true} />;
                }
                return <span key={i}>{part}</span>;
            })}
        </p>
      );
  };

  const renderHeader = () => (
    <div className="flex justify-between items-center w-full px-1 z-10 shrink-0 mb-4">
       <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${phase.bg} ${phase.text}`}>
            {phase.label}
       </div>
       
       <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-zinc-300 dark:text-zinc-700 uppercase tracking-widest px-2 py-0.5 border border-zinc-100 dark:border-zinc-800 rounded-full">{word.type}</span>
           <button 
                onClick={handleFetchMnemonic}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-all border ${showMnemonic ? 'bg-purple-100 text-purple-600 border-purple-200' : 'bg-transparent text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-black dark:hover:text-white'}`}
           >
               {isLoadingMnemonic ? <Loader2 size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
           </button>
       </div>
    </div>
  );

  const renderMnemonicHint = () => {
      if (!showMnemonic || !mnemonic) return null;
      return (
          <div className="mx-0 mb-4 animate-slide-up bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-zinc-900 border border-purple-100 dark:border-purple-800 p-4 rounded-2xl relative shadow-lg shadow-purple-500/5">
              <div className="absolute -top-2 left-4 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <BrainCircuit size={10} /> İpucu
              </div>
              <p className="text-sm font-serif font-medium text-purple-900 dark:text-purple-100 leading-relaxed pt-2">
                  "{mnemonic}"
              </p>
              <button onClick={() => setShowMnemonic(false)} className="absolute top-2 right-2 text-purple-300 hover:text-purple-600 dark:hover:text-purple-200">
                  <X size={14} />
              </button>
          </div>
      );
  };

  const renderQuestion = () => {
    // --- SPEAKING MODE ---
    if (mode === 'speaking') {
        if (!isSpeechSupported) {
            return (
                <div className="flex flex-col flex-1 items-center justify-center text-center animate-fade-in p-6">
                    <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-4 text-orange-600 dark:text-orange-400">
                        <MicOff size={32} />
                    </div>
                    <h3 className="font-bold text-lg mb-2 text-black dark:text-white">Tarayıcı Desteklemiyor</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6 max-w-xs">
                        Cihazınız veya tarayıcınız ses tanıma özelliğini desteklemiyor.
                    </p>
                    <button 
                        onClick={handleReveal}
                        className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold transition-transform active:scale-95"
                    >
                        Cevabı Göster
                    </button>
                </div>
            );
        }

        if (permissionDenied) {
            return (
                <div className="flex flex-col justify-center flex-1 text-center items-center px-4 animate-fade-in">
                     <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-red-500/10">
                        <MicOff size={32} className="text-red-500" />
                     </div>
                     <p className="text-zinc-500 dark:text-zinc-400 mb-4 text-sm max-w-xs">Mikrofona izin verilmedi.</p>
                     <button 
                        onClick={() => { setPermissionDenied(false); startListening(); }}
                        className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm"
                     >
                        Tekrar Dene
                     </button>
                </div>
            );
        }

        return (
            <div className="flex flex-col flex-1 items-center justify-start w-full animate-fade-in overflow-y-auto">
                 <div className="text-center space-y-2 mb-6 shrink-0">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Sesli Oku</p>
                    <h2 className="text-4xl md:text-5xl font-black text-black dark:text-white tracking-tighter drop-shadow-sm px-1 break-words leading-tight">{word.term}</h2>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full cursor-pointer hover:bg-zinc-200 transition-colors" onClick={speak}>
                        <span className="text-sm text-zinc-600 dark:text-zinc-300 font-serif">/{word.pronunciation}/</span>
                        <Volume2 size={14} className="text-zinc-500" />
                    </div>
                 </div>

                 {/* Visualization */}
                 <div className="w-full flex-1 flex flex-col items-center justify-start min-h-[140px]">
                    {!isListening && !spokenText && (
                         <button 
                            onClick={startListening}
                            className="w-20 h-20 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all group relative overflow-hidden"
                        >
                            <Mic size={32} />
                        </button>
                    )}

                    {isListening && (
                        <div className="flex flex-col items-center gap-4">
                            <AudioVisualizer isListening={true} />
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Dinliyorum...</p>
                        </div>
                    )}
                    
                    {spokenText && (
                        <div className="w-full animate-slide-up pb-4">
                            {renderPronunciationFeedback()}
                            <div className="grid grid-cols-2 gap-3 mt-6 w-full">
                                <button onClick={retrySpeaking} className="py-3 rounded-xl font-bold text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-black dark:text-white transition-colors">
                                    Tekrar
                                </button>
                                <button onClick={handleReveal} className={`py-3 rounded-xl font-bold text-xs text-white shadow-lg transition-transform active:scale-95 ${showFeedback === 'correct' ? 'bg-green-600' : 'bg-black dark:bg-white dark:text-black'}`}>
                                    Devam
                                </button>
                            </div>
                        </div>
                    )}
                 </div>
            </div>
        );
    }

    // --- TRANSLATION MODE ---
    if (mode === 'translation') {
        return (
            <div className="flex flex-col flex-1 items-center justify-center text-center animate-fade-in py-4">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-2">Çevirisini Yaz</p>
                <h2 className="text-4xl md:text-5xl font-black text-black dark:text-white tracking-tighter mb-6 leading-tight px-1 break-words">{word.term}</h2>
                
                <button
                    onClick={speak}
                    className="p-3 rounded-full bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                >
                    {isPlaying ? <Waves size={20} className="animate-pulse" /> : <Volume2 size={20} />}
                </button>
            </div>
        );
    }

    // --- WRITING MODE ---
    if (mode === 'writing') {
        return (
            <div className="flex flex-col flex-1 items-center justify-start text-center animate-fade-in overflow-y-auto w-full">
                {renderMnemonicHint()}

                <div className="flex-1 flex flex-col justify-center items-center w-full mb-4">
                    <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center mb-4 border border-orange-100 dark:border-orange-800 -rotate-3">
                        <Keyboard className="text-orange-500" size={24} />
                    </div>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-2">Tanım</p>
                    <p className="text-lg md:text-xl font-serif font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed max-w-sm px-2">
                        "{word.definition}"
                    </p>
                    {word.type && (
                         <div className="mt-3 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-bold uppercase tracking-wide">
                            {word.type}
                         </div>
                    )}
                </div>
            </div>
        );
    }

    // --- CONTEXT MODE ---
    if (mode === 'context') {
        return (
            <div className="flex flex-col flex-1 justify-center animate-fade-in overflow-y-auto w-full">
                {renderMnemonicHint()}
                <div className="w-full max-w-md mx-auto px-2">
                    <div className="flex items-center gap-2 mb-3">
                        <span className={`h-1.5 w-1.5 rounded-full ${isContextRevealed ? 'bg-green-500' : 'bg-purple-500 animate-pulse'}`}></span>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                            {isContextRevealed ? 'Context' : 'Fill Blank'}
                        </span>
                    </div>
                    
                    {isContextRevealed ? (
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-fade-in relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
                            {renderInteractiveSentence()}
                        </div>
                    ) : (
                        <p className="text-xl md:text-2xl font-serif font-medium text-zinc-800 dark:text-zinc-200 leading-loose">
                            {word.exampleSentence.split(new RegExp(`(${word.term})`, 'gi')).map((part, i) => {
                                if (part.toLowerCase() === word.term.toLowerCase()) {
                                    return (
                                        <span key={i} className="inline-block w-24 h-6 bg-zinc-200 dark:bg-zinc-800 border-b-2 border-zinc-300 dark:border-zinc-700 mx-1 rounded-t-sm align-middle animate-pulse"></span>
                                    );
                                }
                                return <span key={i}>{part}</span>;
                            })}
                        </p>
                    )}
                </div>
                {!isContextRevealed && (
                    <div className="mt-6 text-center px-4">
                         <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                            <Lightbulb size={12} className="text-yellow-500" />
                            <span className="text-xs text-zinc-600 dark:text-zinc-400 italic truncate max-w-[200px]">"{word.definition}"</span>
                         </div>
                    </div>
                )}
            </div>
        );
    }

    // --- MEANING MODE (Default) ---
    return (
        <div className="flex flex-col flex-1 items-center justify-center text-center animate-fade-in relative">
             {renderMnemonicHint()}
             
             <div className="flex-1 flex flex-col justify-center items-center">
                 <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Bu kelimeyi hatırlıyor musun?</p>
                 <h2 className="text-4xl md:text-6xl font-black text-black dark:text-white tracking-tighter mb-6 drop-shadow-sm px-1 break-words leading-tight">{word.term}</h2>
                 
                 <button 
                    onClick={speak}
                    className="w-14 h-14 rounded-full bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-zinc-700 hover:shadow-lg transition-all flex items-center justify-center group"
                >
                    {isPlaying ? <Waves size={24} className="animate-pulse text-black dark:text-white" /> : <Volume2 size={24} className="group-hover:scale-110 transition-transform" />}
                </button>
             </div>
        </div>
    );
  };

  const renderInputArea = () => {
    if (showAnswer) return null;

    // Speaking mode handled inside renderQuestion
    if (mode === 'speaking') {
        if (!isSpeechSupported || permissionDenied) return null;
         return (
             <div className="mt-2 shrink-0 w-full">
                {!spokenText && !isListening && (
                  <button 
                    type="button" 
                    onClick={handleReveal} 
                    className="w-full py-3 text-[10px] font-bold text-zinc-300 hover:text-zinc-500 transition-colors uppercase tracking-widest"
                  >
                    Atla ve Cevabı Gör
                  </button>
                )}
             </div>
         );
    }

    // Context Revealed -> Continue
    if (mode === 'context' && isContextRevealed) {
         return (
             <div className="mt-auto shrink-0 w-full animate-slide-up pt-4">
                 <button 
                     onClick={handleReveal}
                     className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold text-base shadow-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                 >
                     Cevabı Kontrol Et <ArrowRight size={18} />
                 </button>
             </div>
         );
    }

    // Standard Inputs
    if (mode === 'writing' || mode === 'context' || mode === 'translation') {
        const placeholder = mode === 'translation' ? 'Türkçe karşılığı...' : 'Kelimeyi yaz...';
        
        return (
            <div className={`mt-auto shrink-0 w-full ${isShaking ? 'animate-shake' : ''} pt-2`}>
                 {incorrectAttempts >= 3 && mode !== 'translation' && (
                     <div className="mb-3 animate-fade-in bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 flex items-center gap-3">
                         <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/40 rounded-full text-yellow-600">
                             <AlertCircle size={16} />
                         </div>
                         <div className="text-left">
                             <p className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 uppercase">Takıldın mı?</p>
                             <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium leading-tight">Tanımı tekrar oku ve yazmayı dene.</p>
                         </div>
                     </div>
                 )}
                 
                 {/* Hints */}
                 {hintLevel > 0 && incorrectAttempts < 3 && mode !== 'translation' && (
                    <div className="mb-3 flex items-center justify-center gap-2 animate-slide-up">
                        <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-300 text-xs font-bold shadow-sm border border-blue-100 dark:border-blue-900/30">
                            /{word.phoneticSpelling || word.pronunciation}/
                        </div>
                        <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <span className="font-mono text-lg font-bold tracking-[0.2em] text-black dark:text-white uppercase">
                                {word.term.slice(0, hintLevel)}
                                <span className="text-zinc-300 dark:text-zinc-600">{word.term.slice(hintLevel).replace(/./g, '_')}</span>
                            </span>
                        </div>
                    </div>
                 )}
                 
                 {mode === 'writing' && incorrectAttempts < 3 && (
                    <div className="flex justify-end mb-2">
                        <button 
                            type="button" 
                            onClick={showHint}
                            disabled={hintLevel >= word.term.length}
                            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 uppercase tracking-wide"
                        >
                            <Lightbulb size={12} />
                            {hintLevel === 0 ? "İpucu" : "Harf Aç"}
                        </button>
                    </div>
                 )}

                 <form onSubmit={mode === 'translation' ? handleTranslationSubmit : handleWritingSubmit} className="relative mb-3">
                    <input 
                        ref={inputRef}
                        type="text" 
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            setShowFeedback(null);
                        }}
                        onFocus={(e) => {
                             setTimeout(() => {
                                 e.target.scrollIntoView({ behavior: "smooth", block: "center" });
                             }, 300);
                        }}
                        placeholder={placeholder}
                        autoCorrect="off"
                        autoCapitalize="none"
                        autoComplete="off"
                        className={`w-full h-14 pl-5 pr-12 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 text-base font-bold outline-none transition-all focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-black placeholder:text-zinc-300 dark:placeholder:text-zinc-700 text-black dark:text-white shadow-sm
                            ${showFeedback === 'correct' ? '!border-green-500 !bg-green-50 dark:!bg-green-900/10 !text-green-700 dark:!text-green-300' : ''}
                            ${showFeedback === 'incorrect' ? '!border-red-500 !bg-red-50 dark:!bg-red-900/10 !text-red-700 dark:!text-red-300' : ''}
                        `}
                    />
                    <button 
                        type="submit" 
                        className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                            showFeedback === 'correct' 
                                ? 'bg-green-500 text-white shadow-lg shadow-green-200' 
                                : showFeedback === 'incorrect' 
                                    ? 'bg-red-500 text-white shadow-lg shadow-red-200' 
                                    : 'bg-black dark:bg-white text-white dark:text-black hover:scale-105 active:scale-95'
                        }`}
                    >
                        {showFeedback === 'correct' ? <Check size={18} /> : showFeedback === 'incorrect' ? <X size={18} /> : <ArrowRight size={18} />}
                    </button>
                 </form>

                 <div className="flex flex-col gap-2">
                     <button 
                        type="button" 
                        onClick={() => {
                            if (mode === 'context') {
                                setIsContextRevealed(true);
                            } else {
                                handleReveal();
                            }
                        }} 
                        className={`w-full py-3.5 text-xs font-bold rounded-xl transition-all uppercase tracking-wider ${
                            incorrectAttempts >= 3 
                                ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg' 
                                : 'text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900'
                        }`}
                    >
                        {incorrectAttempts >= 3 ? "Cevabı Göster" : "Bilmiyorum"}
                    </button>
                     
                     {mode === 'context' && incorrectAttempts > 0 && !isContextRevealed && (
                         <button 
                            type="button" 
                            onClick={() => setIsContextRevealed(true)}
                            className="w-full py-3.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 uppercase tracking-wider"
                         >
                            <Eye size={14} /> Cümleyi Gör
                         </button>
                     )}
                 </div>
            </div>
        );
    }

    // Default "Show Answer" button for Meaning mode
    return (
        <button 
            onClick={handleReveal}
            className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold text-base shadow-xl shadow-zinc-200 dark:shadow-none hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-auto shrink-0"
        >
            <Eye size={20} /> Cevabı Göster
        </button>
    );
  };

  const renderAnswer = () => (
      <div className="animate-slide-up bg-zinc-50 dark:bg-zinc-950 absolute inset-0 z-30 flex flex-col p-6">
         <div className="flex-1 flex flex-col items-center pt-4 overflow-y-auto scrollbar-hide">
             {/* Word Header */}
             <div className="text-center mb-6 animate-fade-in shrink-0">
                 <h2 className="text-4xl md:text-5xl font-black text-black dark:text-white mb-2 tracking-tighter px-1 break-words leading-tight">{word.term}</h2>
                 <p className="text-xl font-medium text-zinc-500 dark:text-zinc-400">{word.translation}</p>
                 
                 <div className="inline-flex items-center gap-2 mt-4 px-4 py-1.5 bg-white dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-sm cursor-pointer hover:border-black dark:hover:border-zinc-600 transition-colors" onClick={speak}>
                     <span className="text-zinc-600 dark:text-zinc-300 font-serif text-sm">/{word.pronunciation}/</span>
                     <Volume2 size={14} className="text-black dark:text-white" />
                 </div>
             </div>

             {/* Details Card */}
             <div className="w-full max-w-sm bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 text-left shrink-0 shadow-sm">
                 <div className="mb-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Örnek</p>
                    {renderInteractiveSentence()}
                 </div>
                 
                 <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                     <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Anlam</p>
                     <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">"{word.definition}"</p>
                 </div>
                 
                 {word.mnemonic && (
                     <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-start gap-2">
                         <div className="p-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                            <BrainCircuit size={16} />
                         </div>
                         <div>
                            <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-0.5">İpucu</p>
                            <p className="text-xs font-medium italic text-zinc-700 dark:text-zinc-300">"{word.mnemonic}"</p>
                         </div>
                     </div>
                 )}
             </div>

             {/* SRS History */}
             {word.history && word.history.length > 0 && (
                <div className="w-full max-w-sm mt-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Geçmiş İncelemeler</p>
                    <div className="space-y-3">
                        {word.history.slice().reverse().slice(0, 5).map((h, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-zinc-500 font-medium">{formatDate(h.date)}</span>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] tracking-wide ${
                                        h.grade === 'again' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                                        h.grade === 'hard' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                                        h.grade === 'good' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                        'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                    }`}>{h.grade}</span>
                                    <span className="text-zinc-400 font-mono">+{Math.round(h.interval)}g</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
             )}
         </div>

         {/* SRS Buttons - Fixed to Bottom */}
         <div className="mt-4 pt-2 shrink-0 w-full max-w-md mx-auto pb-4 md:pb-0">
             <div className="grid grid-cols-2 gap-3">
                <SRSButton 
                    label="Tekrar" 
                    sub="Zor"
                    time={nextIntervals.again} 
                    color="bg-white dark:bg-zinc-900 border-2 border-orange-100 dark:border-orange-900/30 text-orange-600 dark:text-orange-400 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20" 
                    onClick={() => onResult('again')} 
                />
                <SRSButton 
                    label="Tamam" 
                    sub="Kolay"
                    time={nextIntervals.good} 
                    color="bg-black dark:bg-white border-2 border-transparent text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-xl" 
                    onClick={() => onResult('good')} 
                />
             </div>
         </div>
      </div>
  );

  return (
    <div className="relative h-full w-full max-w-md mx-auto flex flex-col bg-white dark:bg-zinc-950 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-zinc-100 dark:border-zinc-900 overflow-hidden transition-all duration-300">
       {/* Main Content Area - Scrollable */}
       <div className={`flex-1 flex flex-col p-6 overflow-y-auto scrollbar-hide transition-opacity duration-300 ${showAnswer ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
           {renderHeader()}
           {renderQuestion()}
           {renderInputArea()}
       </div>

       {/* Answer Overlay */}
       {showAnswer && renderAnswer()}
    </div>
  );
};

const SRSButton = ({ label, sub, time, color, onClick }: { label: string, sub: string, time: string, color: string, onClick: () => void }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`flex flex-col items-center justify-center py-4 rounded-xl active:scale-95 transition-all ${color}`}
  >
    <div className="flex items-center gap-2 mb-0.5">
        <span className="font-bold text-base leading-none">{label}</span>
    </div>
    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{time}</span>
  </button>
);