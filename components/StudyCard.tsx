
import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Eye, ArrowRight, Minus, Plus, AlignLeft, FileText, Lightbulb, Keyboard, BookOpen, Waves, AlertCircle, Sparkles, X, Check, Mic, MicOff, RefreshCw, PlayCircle, Languages, PlusCircle, CheckCircle2, BrainCircuit, Loader2 } from 'lucide-react';
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
            <span className="font-bold text-black bg-yellow-100 px-2 py-0.5 rounded-md cursor-help border-b-2 border-yellow-300 transition-colors hover:bg-yellow-200">
                {text}
            </span>
            
            {showTip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-4 py-3 bg-zinc-900 text-white text-xs rounded-2xl shadow-2xl whitespace-nowrap z-50 flex flex-col items-center gap-2 min-w-[120px] animate-fade-in">
                    <div className="text-center">
                        <span className="font-bold text-base block mb-0.5">{translation}</span>
                        <span className="text-[10px] opacity-70 uppercase tracking-widest block font-medium">{type}</span>
                    </div>
                    
                    <div className="w-full h-px bg-white/10"></div>

                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!isAdded && onAdd) onAdd();
                        }}
                        disabled={isAdded}
                        className={`flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                            isAdded 
                            ? 'bg-green-500/20 text-green-400 cursor-default' 
                            : 'bg-white text-black hover:bg-zinc-200 active:scale-95'
                        }`}
                    >
                        {isAdded ? <CheckCircle2 size={12} /> : <PlusCircle size={12} />}
                        {isAdded ? 'Saved' : 'Add'}
                    </button>

                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-900"></div>
                </div>
            )}
        </span>
    );
};

// Animated Audio Visualizer Component
const AudioVisualizer = ({ isListening }: { isListening: boolean }) => {
    return (
        <div className="flex items-center justify-center gap-1.5 h-16">
            {[1, 2, 3, 4, 5].map((i) => (
                <div 
                    key={i}
                    className={`w-2 bg-black dark:bg-white rounded-full transition-all duration-300 ${
                        isListening ? 'animate-pulse' : 'h-2 opacity-10'
                    }`}
                    style={{ 
                        height: isListening ? `${Math.max(10, Math.random() * 100)}%` : '8px',
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
          alert("Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.");
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

          // More forgiving threshold
          if (score >= 85) {
              setPronunciationScore(100); // Round up high scores for UX
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
          // If no speech detected
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
          case 'meaning': return { label: 'Step 1: Meaning', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-300' };
          case 'translation': return { label: 'Translation', bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-300' };
          case 'context': return { label: 'Step 2: Context', bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-300' };
          case 'writing': return { label: 'Step 3: Writing', bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-300' };
          case 'speaking': return { label: 'Step 4: Speaking', bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-300' };
          default: return { label: 'Review', bg: 'bg-zinc-100', text: 'text-zinc-500' };
      }
  };

  const phase = getPhaseLabel();

  // Helper to render detailed diff between target and spoken word
  const renderPronunciationFeedback = () => {
      if (!spokenText) return null;
      
      const targetChars = word.term.split('');
      const spokenClean = normalizeText(spokenText);
      const isPerfect = pronunciationScore === 100;
      
      return (
          <div className="flex flex-col items-center gap-6 animate-fade-in w-full">
             {/* Score Ring */}
             <div className="relative w-32 h-32 flex items-center justify-center">
                 <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                    <path className="text-zinc-100 dark:text-zinc-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    <path 
                        className={`${isPerfect ? 'text-green-500' : 'text-orange-500'} transition-all duration-1000 ease-out`} 
                        strokeDasharray={`${pronunciationScore}, 100`} 
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="3" 
                        strokeLinecap="round"
                    />
                 </svg>
                 <div className="absolute flex flex-col items-center justify-center">
                     <span className={`text-4xl font-black ${isPerfect ? 'text-green-600 dark:text-green-400' : 'text-orange-500'}`}>
                        {pronunciationScore}%
                     </span>
                     <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Match</span>
                 </div>
             </div>

             {/* Comparison Card */}
             <div 
                onClick={speak} 
                className="cursor-pointer group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full text-center hover:border-black dark:hover:border-white transition-all shadow-sm hover:shadow-lg"
             >
                 <div className="mb-4">
                     <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Target</p>
                     <div className="flex justify-center flex-wrap gap-0.5 font-mono text-3xl font-black tracking-widest">
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
                     <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Heard</p>
                        <p className="text-xl text-zinc-600 dark:text-zinc-300 font-medium italic">"{spokenText}"</p>
                     </div>
                 )}
                 
                 <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold text-blue-500 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                    <Volume2 size={12} /> Tap to replay
                 </div>
             </div>
          </div>
      );
  };

  const renderInteractiveSentence = () => {
      return (
        <p className="text-2xl font-serif font-medium text-zinc-800 dark:text-zinc-200 leading-loose">
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
    <div className="flex justify-between items-center w-full px-2 z-10 shrink-0">
       <div className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 ${phase.bg} ${phase.text}`}>
            {phase.label}
       </div>
       
       <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-zinc-300 dark:text-zinc-700 uppercase tracking-widest px-3 py-1 border border-zinc-100 dark:border-zinc-800 rounded-full">{word.type}</span>
           <button 
                onClick={handleFetchMnemonic}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-all border ${showMnemonic ? 'bg-purple-100 text-purple-600 border-purple-200' : 'bg-transparent text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-black dark:hover:text-white'}`}
           >
               {isLoadingMnemonic ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
           </button>
       </div>
    </div>
  );

  const renderMnemonicHint = () => {
      if (!showMnemonic || !mnemonic) return null;
      return (
          <div className="mx-2 mb-6 animate-slide-up bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-zinc-900 border border-purple-100 dark:border-purple-800 p-5 rounded-3xl relative shadow-lg shadow-purple-500/5">
              <div className="absolute -top-3 left-4 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <BrainCircuit size={12} /> Memory Hook
              </div>
              <p className="text-base font-serif font-medium text-purple-900 dark:text-purple-100 leading-relaxed pt-2">
                  "{mnemonic}"
              </p>
              <button onClick={() => setShowMnemonic(false)} className="absolute top-3 right-3 text-purple-300 hover:text-purple-600 dark:hover:text-purple-200">
                  <X size={16} />
              </button>
          </div>
      );
  };

  const renderQuestion = () => {
    // --- SPEAKING MODE ---
    if (mode === 'speaking') {
        if (permissionDenied) {
            return (
                <div className="flex flex-col justify-center flex-1 text-center items-center px-4">
                     <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-red-500/10">
                        <MicOff size={40} className="text-red-500" />
                     </div>
                     <h3 className="text-2xl font-bold text-black dark:text-white mb-2">Microphone Access Denied</h3>
                     <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-xs">Please allow microphone access in your browser settings.</p>
                     <button 
                        onClick={() => { setPermissionDenied(false); startListening(); }}
                        className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold shadow-xl active:scale-95 transition-all"
                     >
                        Retry
                     </button>
                </div>
            );
        }

        return (
            <div className="flex flex-col flex-1 items-center justify-start pt-8 pb-4 w-full animate-fade-in">
                 <div className="text-center space-y-2 mb-8">
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Read Aloud</p>
                    <h2 className="text-5xl md:text-6xl font-black text-black dark:text-white tracking-tighter drop-shadow-sm px-2 break-words">{word.term}</h2>
                    <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full cursor-pointer hover:bg-zinc-200 transition-colors" onClick={speak}>
                        <span className="text-lg text-zinc-600 dark:text-zinc-300 font-serif">/{word.pronunciation}/</span>
                        <Volume2 size={16} className="text-zinc-500" />
                    </div>
                 </div>

                 {/* Visualization */}
                 <div className="w-full flex-1 flex flex-col items-center justify-center min-h-[160px]">
                    {!isListening && !spokenText && (
                         <button 
                            onClick={startListening}
                            className="w-28 h-28 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent group-hover:animate-pulse"></div>
                            <Mic size={48} />
                        </button>
                    )}

                    {isListening && (
                        <div className="flex flex-col items-center gap-6">
                            <AudioVisualizer isListening={true} />
                            <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Listening...</p>
                        </div>
                    )}
                    
                    {spokenText && (
                        <div className="w-full animate-slide-up pb-8">
                            {renderPronunciationFeedback()}
                            <div className="grid grid-cols-2 gap-4 mt-8 w-full">
                                <button onClick={retrySpeaking} className="py-4 rounded-2xl font-bold text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-black dark:text-white transition-colors">
                                    Try Again
                                </button>
                                <button onClick={handleReveal} className={`py-4 rounded-2xl font-bold text-sm text-white shadow-lg transition-transform active:scale-95 ${showFeedback === 'correct' ? 'bg-green-600' : 'bg-black dark:bg-white dark:text-black'}`}>
                                    Continue
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
            <div className="flex flex-col flex-1 items-center justify-center text-center animate-fade-in py-8">
                 <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center mb-8 border border-indigo-100 dark:border-indigo-800 rotate-3">
                    <Languages className="text-indigo-500" size={40} />
                </div>
                
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mb-4">Translate this</p>
                <h2 className="text-5xl md:text-6xl font-black text-black dark:text-white tracking-tighter mb-8 leading-tight px-2 break-words">{word.term}</h2>
                
                <button
                    onClick={speak}
                    className="p-4 rounded-full bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                >
                    {isPlaying ? <Waves size={24} className="animate-pulse" /> : <Volume2 size={24} />}
                </button>
            </div>
        );
    }

    // --- WRITING MODE ---
    if (mode === 'writing') {
        return (
            <div className="flex flex-col flex-1 items-center justify-start pt-4 text-center animate-fade-in overflow-y-auto">
                {renderMnemonicHint()}

                <div className="flex-1 flex flex-col justify-center items-center mb-6">
                    <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center mb-6 border border-orange-100 dark:border-orange-800 -rotate-3">
                        <Keyboard className="text-orange-500" size={32} />
                    </div>
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mb-4">Definition</p>
                    <p className="text-2xl md:text-3xl font-serif font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed max-w-sm">
                        "{word.definition}"
                    </p>
                    {word.type && (
                         <div className="mt-4 px-4 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs font-bold uppercase tracking-wide">
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
                <div className="w-full max-w-md mx-auto">
                    <div className="flex items-center gap-2 mb-4">
                        <span className={`h-2 w-2 rounded-full ${isContextRevealed ? 'bg-green-500' : 'bg-purple-500 animate-pulse'}`}></span>
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                            {isContextRevealed ? 'Read Full Context' : 'Fill in the Blank'}
                        </span>
                    </div>
                    
                    {isContextRevealed ? (
                        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm animate-fade-in relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-2 h-full bg-purple-500"></div>
                            {renderInteractiveSentence()}
                        </div>
                    ) : (
                        <p className="text-3xl font-serif font-medium text-zinc-800 dark:text-zinc-200 leading-loose">
                            {word.exampleSentence.split(new RegExp(`(${word.term})`, 'gi')).map((part, i) => {
                                if (part.toLowerCase() === word.term.toLowerCase()) {
                                    return (
                                        <span key={i} className="inline-block w-32 h-8 bg-zinc-200 dark:bg-zinc-800 border-b-4 border-zinc-300 dark:border-zinc-700 mx-1.5 rounded-t-md align-middle animate-pulse"></span>
                                    );
                                }
                                return <span key={i}>{part}</span>;
                            })}
                        </p>
                    )}
                </div>
                {!isContextRevealed && (
                    <div className="mt-8 text-center">
                         <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                            <Lightbulb size={14} className="text-yellow-500" />
                            <span className="text-sm text-zinc-600 dark:text-zinc-400 italic">"{word.definition}"</span>
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
                 <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">Do you recall this word?</p>
                 <h2 className="text-5xl md:text-7xl font-black text-black dark:text-white tracking-tighter mb-8 drop-shadow-sm px-2 break-words">{word.term}</h2>
                 
                 <button 
                    onClick={speak}
                    className="w-16 h-16 rounded-full bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-zinc-700 hover:shadow-lg transition-all flex items-center justify-center group"
                >
                    {isPlaying ? <Waves size={32} className="animate-pulse text-black dark:text-white" /> : <Volume2 size={32} className="group-hover:scale-110 transition-transform" />}
                </button>
             </div>
        </div>
    );
  };

  const renderInputArea = () => {
    if (showAnswer) return null;

    // Speaking mode handled inside renderQuestion
    if (mode === 'speaking') {
        if (permissionDenied) return null;
         return (
             <div className="mt-4 shrink-0 w-full">
                {!spokenText && !isListening && (
                  <button 
                    type="button" 
                    onClick={handleReveal} 
                    className="w-full py-4 text-xs font-bold text-zinc-300 hover:text-zinc-500 transition-colors"
                  >
                    Skip to answer
                  </button>
                )}
             </div>
         );
    }

    // Context Revealed -> Continue
    if (mode === 'context' && isContextRevealed) {
         return (
             <div className="mt-auto shrink-0 w-full animate-slide-up">
                 <button 
                     onClick={handleReveal}
                     className="w-full bg-black dark:bg-white text-white dark:text-black py-5 rounded-2xl font-bold text-lg shadow-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                 >
                     Check Answer <ArrowRight size={20} />
                 </button>
             </div>
         );
    }

    // Standard Inputs
    if (mode === 'writing' || mode === 'context' || mode === 'translation') {
        const placeholder = mode === 'translation' ? 'Turkish translation...' : 'Type the word...';
        
        return (
            <div className={`mt-auto shrink-0 w-full ${isShaking ? 'animate-shake' : ''}`}>
                 {incorrectAttempts >= 3 && mode !== 'translation' && (
                     <div className="mb-4 animate-fade-in bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4 flex items-center gap-4">
                         <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-full text-yellow-600">
                             <AlertCircle size={20} />
                         </div>
                         <div className="text-left">
                             <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400 uppercase">Stuck?</p>
                             <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium leading-tight">Read the definition and try spelling it again.</p>
                         </div>
                     </div>
                 )}
                 
                 {/* Hints */}
                 {hintLevel > 0 && incorrectAttempts < 3 && mode !== 'translation' && (
                    <div className="mb-4 flex items-center justify-center gap-3 animate-slide-up">
                        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-300 text-sm font-bold shadow-sm border border-blue-100 dark:border-blue-900/30">
                            /{word.phoneticSpelling || word.pronunciation}/
                        </div>
                        <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            <span className="font-mono text-xl font-bold tracking-[0.2em] text-black dark:text-white uppercase">
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
                            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <Lightbulb size={12} />
                            {hintLevel === 0 ? "Get Hint" : "Reveal Letter"}
                        </button>
                    </div>
                 )}

                 <form onSubmit={mode === 'translation' ? handleTranslationSubmit : handleWritingSubmit} className="relative mb-4">
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
                        className={`w-full h-16 pl-6 pr-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 text-lg font-bold outline-none transition-all focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-black placeholder:text-zinc-300 dark:placeholder:text-zinc-700 text-black dark:text-white shadow-sm
                            ${showFeedback === 'correct' ? '!border-green-500 !bg-green-50 dark:!bg-green-900/10 !text-green-700 dark:!text-green-300' : ''}
                            ${showFeedback === 'incorrect' ? '!border-red-500 !bg-red-50 dark:!bg-red-900/10 !text-red-700 dark:!text-red-300' : ''}
                        `}
                    />
                    <button 
                        type="submit" 
                        className={`absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                            showFeedback === 'correct' 
                                ? 'bg-green-500 text-white shadow-lg shadow-green-200' 
                                : showFeedback === 'incorrect' 
                                    ? 'bg-red-500 text-white shadow-lg shadow-red-200' 
                                    : 'bg-black dark:bg-white text-white dark:text-black hover:scale-105 active:scale-95'
                        }`}
                    >
                        {showFeedback === 'correct' ? <Check size={20} /> : showFeedback === 'incorrect' ? <X size={20} /> : <ArrowRight size={20} />}
                    </button>
                 </form>

                 <div className="flex flex-col gap-3">
                     <button 
                        type="button" 
                        onClick={() => {
                            if (mode === 'context') {
                                setIsContextRevealed(true);
                            } else {
                                handleReveal();
                            }
                        }} 
                        className={`w-full py-4 text-sm font-bold rounded-2xl transition-all ${
                            incorrectAttempts >= 3 
                                ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg' 
                                : 'text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900'
                        }`}
                    >
                        {incorrectAttempts >= 3 ? "Show Answer" : "I don't know"}
                    </button>
                     
                     {mode === 'context' && incorrectAttempts > 0 && !isContextRevealed && (
                         <button 
                            type="button" 
                            onClick={() => setIsContextRevealed(true)}
                            className="w-full py-4 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
                         >
                            <Eye size={16} /> Reveal Sentence
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
            className="w-full bg-black dark:bg-white text-white dark:text-black py-5 rounded-2xl font-bold text-lg shadow-xl shadow-zinc-200 dark:shadow-none hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 mt-auto shrink-0"
        >
            <Eye size={22} /> Show Answer
        </button>
    );
  };

  const renderAnswer = () => (
      <div className="animate-slide-up bg-zinc-50 dark:bg-zinc-950 absolute inset-0 z-30 flex flex-col p-6 md:p-8">
         <div className="flex-1 flex flex-col items-center pt-8 overflow-y-auto scrollbar-hide">
             {/* Word Header */}
             <div className="text-center mb-8 animate-fade-in shrink-0">
                 <h2 className="text-5xl md:text-6xl font-black text-black dark:text-white mb-2 tracking-tighter px-2 break-words">{word.term}</h2>
                 <p className="text-2xl font-medium text-zinc-500 dark:text-zinc-400">{word.translation}</p>
                 
                 <div className="inline-flex items-center gap-3 mt-6 px-5 py-2 bg-white dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-sm cursor-pointer hover:border-black dark:hover:border-zinc-600 transition-colors" onClick={speak}>
                     <span className="text-zinc-600 dark:text-zinc-300 font-serif text-lg">/{word.pronunciation}/</span>
                     <Volume2 size={16} className="text-black dark:text-white" />
                 </div>
             </div>

             {/* Details Card */}
             <div className="w-full max-w-sm bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 text-left shrink-0 shadow-sm">
                 <div className="mb-6">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Example</p>
                    {renderInteractiveSentence()}
                 </div>
                 
                 <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                     <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Meaning</p>
                     <p className="text-base text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">"{word.definition}"</p>
                 </div>
                 
                 {word.mnemonic && (
                     <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-start gap-3">
                         <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                            <BrainCircuit size={18} />
                         </div>
                         <div>
                            <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">Memory Hook</p>
                            <p className="text-sm font-medium italic text-zinc-700 dark:text-zinc-300">"{word.mnemonic}"</p>
                         </div>
                     </div>
                 )}
             </div>
         </div>

         {/* SRS Buttons - Fixed to Bottom */}
         <div className="mt-4 pt-4 shrink-0 w-full max-w-md mx-auto">
             <div className="grid grid-cols-2 gap-4">
                <SRSButton 
                    label="Needs Practice" 
                    sub="Hard"
                    time={nextIntervals.again} 
                    color="bg-white dark:bg-zinc-900 border-2 border-orange-100 dark:border-orange-900/30 text-orange-600 dark:text-orange-400 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20" 
                    onClick={() => onResult('again')} 
                />
                <SRSButton 
                    label="Got it" 
                    sub="Good"
                    time={nextIntervals.good} 
                    color="bg-black dark:bg-white border-2 border-transparent text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-xl" 
                    onClick={() => onResult('good')} 
                />
             </div>
         </div>
      </div>
  );

  return (
    <div className="relative h-full w-full max-w-md mx-auto flex flex-col bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-zinc-100 dark:border-zinc-900 overflow-hidden transition-all duration-300">
       {/* Main Content Area */}
       <div className={`flex-1 flex flex-col p-6 md:p-8 transition-opacity duration-300 overflow-y-auto scrollbar-hide ${showAnswer ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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
    className={`flex flex-col items-center justify-center py-5 rounded-2xl active:scale-95 transition-all ${color}`}
  >
    <div className="flex items-center gap-2 mb-0.5">
        <span className="font-bold text-lg leading-none">{label}</span>
    </div>
    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{time} • {sub}</span>
  </button>
);
