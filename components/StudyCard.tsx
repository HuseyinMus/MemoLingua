
import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Eye, ArrowRight, Minus, Plus, AlignLeft, FileText, Lightbulb, Keyboard, BookOpen, Waves, AlertCircle, Sparkles, X, Check, Mic, MicOff, RefreshCw, PlayCircle, Languages } from 'lucide-react';
import { UserWord, SRSState, StudyMode } from '../types';
import { playGeminiAudio } from '../services/geminiService';

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
}

const InteractiveWord: React.FC<InteractiveWordProps> = ({ text, translation, type }) => {
    const [showTip, setShowTip] = useState(false);
    
    return (
        <span 
            className="relative inline-block"
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
            onClick={(e) => { e.stopPropagation(); setShowTip(!showTip); }}
        >
            <span className="font-bold text-black bg-yellow-100 px-1.5 py-0.5 rounded cursor-help border-b-2 border-yellow-200 transition-colors hover:bg-yellow-200">
                {text}
            </span>
            
            {showTip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 bg-black text-white text-xs rounded-xl shadow-xl whitespace-nowrap z-50 animate-fade-in flex flex-col items-center">
                    <span className="font-bold text-sm">{translation}</span>
                    <span className="text-[10px] opacity-70 uppercase tracking-widest">{type}</span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black"></div>
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
                        isListening ? 'animate-pulse' : 'h-1.5 opacity-20'
                    }`}
                    style={{ 
                        height: isListening ? `${Math.random() * 100}%` : '6px',
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '0.8s'
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

  // Speaking Mode State
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [pronunciationScore, setPronunciationScore] = useState<number>(0);
  const recognitionRef = useRef<any>(null);

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
    
    if (mode === 'writing' || mode === 'context' || mode === 'translation') {
        setTimeout(() => inputRef.current?.focus(), 100);
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

      // Check if the input is contained in the translation (to handle commas, multiple meanings)
      // or if there's a reasonably high match
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
          case 'meaning': return { label: 'Step 1: Meaning', color: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' };
          case 'translation': return { label: 'Step 1.5: Translation', color: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' };
          case 'context': return { label: 'Step 2: Context', color: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' };
          case 'writing': return { label: 'Step 3: Writing', color: 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' };
          case 'speaking': return { label: 'Step 4: Speaking', color: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800' };
          default: return { label: 'Review', color: 'bg-zinc-50 text-zinc-500' };
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
                     <span className={`text-3xl font-black ${isPerfect ? 'text-green-600 dark:text-green-400' : 'text-orange-500'}`}>
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
                     {/* Target Word with Highlighted Errors */}
                     <div className="flex justify-center flex-wrap gap-0.5 font-mono text-3xl font-black tracking-widest">
                        {targetChars.map((char, i) => {
                            // Simple visual diff logic
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

                 {/* What they said */}
                 {!isPerfect && (
                     <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Heard</p>
                        <p className="text-lg text-zinc-600 dark:text-zinc-300 font-medium italic">"{spokenText}"</p>
                     </div>
                 )}
                 
                 <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold text-blue-500 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                    <Volume2 size={12} /> Tap to compare audio
                 </div>
             </div>
          </div>
      );
  };

  const renderInteractiveSentence = () => {
      return (
        <p className="text-lg md:text-xl font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">
            {word.exampleSentence.split(new RegExp(`(${word.term})`, 'gi')).map((part, i) => {
                if (part.toLowerCase() === word.term.toLowerCase()) {
                    return <InteractiveWord key={i} text={part} translation={word.translation} type={word.type} />;
                }
                return <span key={i}>{part}</span>;
            })}
        </p>
      );
  };

  const renderHeader = () => (
    <div className="flex justify-between items-center mb-4 md:mb-6 shrink-0">
       <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${phase.color}`}>
                {phase.label}
            </div>
            <span className="text-[10px] font-bold text-zinc-300 dark:text-zinc-600 uppercase tracking-widest pl-2 border-l border-zinc-100 dark:border-zinc-800">{word.type}</span>
       </div>
       <div className="flex items-center gap-2">
           {mode === 'writing' && (
               <button onClick={speak} className={`p-2 rounded-full transition-all ${isPlaying ? 'text-black dark:text-white' : 'text-zinc-300 hover:text-black dark:hover:text-white'}`}>
                  {isPlaying ? <Waves size={18} className="animate-pulse" /> : <Volume2 size={18} />}
               </button>
           )}
       </div>
    </div>
  );

  const renderQuestion = () => {
    // --- SPEAKING MODE UI ---
    if (mode === 'speaking') {
        if (permissionDenied) {
            return (
                <div className="flex flex-col justify-center flex-1 text-center space-y-6 animate-fade-in items-center">
                     <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-2 shadow-sm border border-red-100 dark:border-red-900/30">
                        <MicOff size={32} className="text-red-500" />
                     </div>
                     <div className="space-y-2">
                        <h3 className="text-xl font-bold text-red-600">Microphone Access Denied</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto text-sm">Please allow microphone access in your browser settings to use Speaking Mode.</p>
                     </div>
                     <button 
                        onClick={() => { setPermissionDenied(false); startListening(); }}
                        className="px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold shadow-xl active:scale-95 transition-all"
                     >
                        Try Again
                     </button>
                     <button 
                        onClick={speak}
                        className="text-sm font-bold text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                     >
                        Play Pronunciation Instead
                     </button>
                </div>
            );
        }

        return (
            <div className="flex flex-col justify-center flex-1 text-center space-y-8 animate-fade-in overflow-y-auto items-center py-4">
                 <div className="space-y-3">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Speak the word</p>
                    <h2 className="text-5xl font-black text-black dark:text-white tracking-tight">{word.term}</h2>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                        <span className="text-lg text-zinc-600 dark:text-zinc-300 font-serif">/{word.pronunciation}/</span>
                        <button onClick={speak} className="text-zinc-400 hover:text-black dark:hover:text-white">
                            <Volume2 size={14} />
                        </button>
                    </div>
                 </div>

                 {/* Audio Visualization / Status Area */}
                 <div className="relative h-32 w-full flex items-center justify-center">
                    {!isListening && !spokenText && (
                         <button 
                            onClick={startListening}
                            className="w-24 h-24 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all group"
                        >
                            <Mic size={40} className="group-hover:animate-pulse" />
                        </button>
                    )}

                    {isListening && (
                        <div className="flex flex-col items-center gap-4">
                            <AudioVisualizer isListening={true} />
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest animate-pulse">Listening...</p>
                        </div>
                    )}
                 </div>

                 {spokenText ? (
                     <div className="w-full animate-slide-up">
                         {renderPronunciationFeedback()}

                         <div className="grid grid-cols-2 gap-3 mt-8">
                            <button 
                                onClick={retrySpeaking}
                                className="flex items-center justify-center gap-2 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-transform text-black dark:text-white"
                            >
                                <RefreshCw size={16} /> Try Again
                            </button>
                            <button 
                                onClick={handleReveal}
                                className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm text-white shadow-xl active:scale-95 transition-transform ${showFeedback === 'correct' ? 'bg-green-600 hover:bg-green-700 shadow-green-200 dark:shadow-none' : 'bg-black dark:bg-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200'}`}
                            >
                                Continue <ArrowRight size={16} />
                            </button>
                         </div>
                     </div>
                 ) : (
                    <div className="h-10"></div> 
                 )}
            </div>
        );
    }

    // TRANSLATION MODE: Show English Term, ask for Turkish translation
    if (mode === 'translation') {
        return (
            <div className="flex flex-col justify-center flex-1 text-center space-y-4 md:space-y-6 animate-fade-in overflow-y-auto">
                 <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-zinc-100 dark:border-zinc-700 shadow-sm shrink-0">
                    <Languages className="text-zinc-400" size={28} />
                </div>
                
                <div className="space-y-3">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Translate to Turkish</p>
                    <h2 className="text-4xl md:text-5xl font-black text-black dark:text-white tracking-tight">{word.term}</h2>
                    
                    <button
                        onClick={speak}
                        type="button"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-xs font-bold mx-auto border border-zinc-100 dark:border-zinc-700 hover:border-zinc-200 dark:hover:border-zinc-600 active:scale-95"
                    >
                        {isPlaying ? <Waves size={14} className="animate-pulse" /> : <Volume2 size={14} />}
                        <span>Play Audio</span>
                    </button>
                </div>
            </div>
        );
    }

    // WRITING MODE: Show definition, ask for word
    if (mode === 'writing') {
        return (
            <div className="flex flex-col justify-center flex-1 text-center space-y-4 md:space-y-6 animate-fade-in overflow-y-auto">
                <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-zinc-100 dark:border-zinc-700 shadow-sm shrink-0">
                    <Keyboard className="text-zinc-400" size={28} />
                </div>
                
                <div className="space-y-3">
                    <div>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-2">Definition</p>
                        <p className="text-lg md:text-2xl font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed max-w-sm mx-auto">
                            {word.definition}
                        </p>
                    </div>

                    <button
                        onClick={speak}
                        type="button"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-xs font-bold mx-auto border border-zinc-100 dark:border-zinc-700 hover:border-zinc-200 dark:hover:border-zinc-600 active:scale-95"
                    >
                        {isPlaying ? <Waves size={14} className="animate-pulse" /> : <Volume2 size={14} />}
                        <span>Play Pronunciation</span>
                    </button>

                    {word.type && (
                         <div className="inline-block px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs font-bold uppercase tracking-wide">
                            {word.type}
                         </div>
                    )}
                </div>
            </div>
        );
    }

    // CONTEXT MODE: Show sentence with blank, ask for word
    if (mode === 'context') {
        return (
            <div className="flex flex-col justify-center flex-1 space-y-4 md:space-y-8 animate-fade-in overflow-y-auto">
                <div className="space-y-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border border-zinc-200 dark:border-zinc-800 px-2 py-1 rounded inline-block">
                        {isContextRevealed ? 'Read in Context' : 'Complete the Sentence'}
                    </span>
                    
                    {isContextRevealed ? (
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 animate-fade-in">
                            {renderInteractiveSentence()}
                        </div>
                    ) : (
                        <p className="text-lg md:text-xl font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">
                            {word.exampleSentence.split(new RegExp(`(${word.term})`, 'gi')).map((part, i) => {
                                // Check if this part matches the term (case insensitive)
                                if (part.toLowerCase() === word.term.toLowerCase()) {
                                    return (
                                        <span key={i} className="inline-block w-20 md:w-24 h-6 md:h-8 bg-zinc-100 dark:bg-zinc-800 border-b-2 border-zinc-300 dark:border-zinc-600 mx-1 align-bottom rounded-t-sm animate-pulse"></span>
                                    );
                                }
                                return <span key={i}>{part}</span>;
                            })}
                        </p>
                    )}
                </div>
                {!isContextRevealed && (
                    <div>
                         <div className="flex items-center gap-2 text-zinc-400 mb-1">
                            <Lightbulb size={12} />
                            <span className="text-xs font-bold uppercase tracking-widest">Hint</span>
                         </div>
                         <p className="text-zinc-500 italic text-sm">"{word.definition}"</p>
                    </div>
                )}
            </div>
        );
    }

    // MEANING MODE: Show English word first, ask for recall of meaning
    return (
        <div className="flex flex-col justify-center flex-1 space-y-4 md:space-y-6 animate-fade-in text-center overflow-y-auto">
             <div className="space-y-3 md:space-y-4">
                 <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">English Term</span>
                 <h2 className="text-4xl md:text-5xl font-bold text-black dark:text-white tracking-tight">{word.term}</h2>
                 <div className="flex justify-center">
                    <button 
                        onClick={speak}
                        className="p-3 rounded-full bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                        {isPlaying ? <Waves size={20} className="animate-pulse" /> : <Volume2 size={20} />}
                    </button>
                 </div>
             </div>
             
             <div className="w-12 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full mx-auto my-4 md:my-6"></div>

             <div className="space-y-1 opacity-50">
                 <p className="text-sm font-medium text-zinc-400">Do you know the meaning?</p>
             </div>
        </div>
    );
  };

  const renderInputArea = () => {
    if (showAnswer) return null;

    // Speaking mode input area
    if (mode === 'speaking') {
        if (permissionDenied) return null;
         return (
             <div className="mt-auto shrink-0 w-full max-w-sm mx-auto">
                {!spokenText && !isListening && (
                  <button 
                    type="button" 
                    onClick={handleReveal} 
                    className="w-full py-4 text-xs font-bold text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-xl transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    I can't speak right now
                  </button>
                )}
             </div>
         );
    }

    // If we have revealed the context, show the "Continue" button
    if (mode === 'context' && isContextRevealed) {
         return (
             <div className="mt-4 shrink-0 w-full max-w-sm mx-auto animate-slide-up">
                 <button 
                     onClick={handleReveal}
                     className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold shadow-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                 >
                     Continue to Rating <ArrowRight size={18} />
                 </button>
             </div>
         );
    }

    // Standard Input Area (Writing, Translation, Context)
    if (mode === 'writing' || mode === 'context' || mode === 'translation') {
        const placeholder = mode === 'translation' ? 'Türkçe karşılığı...' : 'Type the word...';
        
        return (
            <div className={`mt-4 shrink-0 w-full max-w-sm mx-auto ${isShaking ? 'animate-shake' : ''}`}>
                 {incorrectAttempts >= 3 && mode !== 'translation' && (
                     <div className="mb-4 animate-fade-in bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 rounded-2xl p-4 text-center">
                         <div className="flex items-center justify-center gap-2 mb-1 text-yellow-600 dark:text-yellow-400">
                             <AlertCircle size={16} />
                             <span className="text-xs font-bold uppercase tracking-widest">Keep Going</span>
                         </div>
                         <p className="text-sm text-yellow-700 dark:text-yellow-200 font-medium">Read the definition above and try spelling it one more time.</p>
                     </div>
                 )}
                 
                 {/* Progressive Hint Display with Phonetic Spelling */}
                 {hintLevel > 0 && incorrectAttempts < 3 && mode !== 'translation' && (
                    <div className="mb-4 flex flex-col items-center gap-3 animate-slide-up">
                        <div className="text-xs font-bold text-blue-500 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm">
                            <span className="text-blue-300">Phonetic</span>
                            <span className="font-medium">{word.phoneticSpelling || word.pronunciation}</span>
                        </div>

                        <div className="bg-zinc-100/80 dark:bg-zinc-800/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            <span className="font-mono text-xl font-bold tracking-[0.2em] text-black dark:text-white uppercase">
                                {word.term.slice(0, hintLevel)}
                                <span className="text-zinc-300 dark:text-zinc-600">{word.term.slice(hintLevel).replace(/./g, '_')}</span>
                            </span>
                        </div>
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
                        className={`w-full p-4 pr-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center text-lg font-medium outline-none transition-all focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white focus:bg-white dark:focus:bg-zinc-800 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 text-black dark:text-white
                            ${showFeedback === 'correct' ? '!border-green-500 !bg-green-50 dark:!bg-green-900/20 !text-green-700 dark:!text-green-300' : ''}
                            ${showFeedback === 'incorrect' ? '!border-red-500 !bg-red-50 dark:!bg-red-900/20 !text-red-700 dark:!text-red-300' : ''}
                        `}
                    />
                    <button 
                        type="submit" 
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl active:scale-95 transition-all shadow-md ${
                            showFeedback === 'correct' 
                                ? 'bg-green-500 text-white shadow-green-200 dark:shadow-none' 
                                : showFeedback === 'incorrect' 
                                    ? 'bg-red-500 text-white shadow-red-200 dark:shadow-none' 
                                    : 'bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200'
                        }`}
                    >
                        {showFeedback === 'correct' ? <Check size={18} /> : showFeedback === 'incorrect' ? <X size={18} /> : <ArrowRight size={18} />}
                    </button>
                    {mode === 'writing' && (
                        <button 
                            type="button" 
                            onClick={speak}
                            className="absolute right-14 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                        >
                            {isPlaying ? <Waves size={18} className="animate-pulse" /> : <Volume2 size={18} />}
                        </button>
                    )}
                 </form>
                 <div className="flex flex-col gap-2">
                     <div className="flex gap-2">
                        {mode !== 'translation' && (
                            <button type="button" onClick={showHint} className="flex-1 py-3 text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl transition-colors border border-blue-100 dark:border-blue-900/30 flex items-center justify-center gap-1">
                                {hintLevel === 0 ? <><Lightbulb size={12}/> Get Hint</> : "Reveal next letter"}
                            </button>
                        )}
                        <button 
                            type="button" 
                            onClick={() => {
                                if (mode === 'context') {
                                    setIsContextRevealed(true);
                                } else {
                                    handleReveal();
                                }
                            }} 
                            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-colors ${
                                incorrectAttempts >= 3 
                                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg' 
                                    : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                            }`}
                        >
                            {incorrectAttempts >= 3 ? "Reveal Answer" : "I don't know"}
                        </button>
                     </div>
                     
                     {/* If incorrect attempt, show prominent Reveal Sentence button for Context Mode */}
                     {mode === 'context' && incorrectAttempts > 0 && !isContextRevealed && (
                         <button 
                            type="button" 
                            onClick={() => setIsContextRevealed(true)}
                            className="w-full py-4 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg active:scale-95"
                         >
                            <Eye size={16} /> Reveal Full Sentence
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
            className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold text-lg shadow-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 flex items-center justify-center gap-2 mt-auto shrink-0"
        >
            <Eye size={20} /> Show Answer
        </button>
    );
  };

  const renderAnswer = () => (
      <div className="animate-slide-up bg-white dark:bg-zinc-900 absolute inset-0 z-20 flex flex-col p-6 md:p-8">
         <div className="flex-1 flex flex-col items-center justify-center text-center overflow-y-auto">
             <div className="mb-4 md:mb-8 animate-fade-in shrink-0">
                 <h2 className="text-3xl md:text-4xl font-bold text-black dark:text-white mb-2 tracking-tighter">{word.term}</h2>
                 <p className="text-xl md:text-2xl font-medium text-zinc-600 dark:text-zinc-300 mb-4">{word.translation}</p>
                 
                 <div className="flex items-center justify-center gap-2 mb-4">
                     <span className="text-zinc-400 font-mono text-lg">/{word.pronunciation}/</span>
                     <button onClick={speak} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-600 dark:text-zinc-400 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors">
                         <Volume2 size={16} />
                     </button>
                 </div>
             </div>

             <div className="w-full max-w-sm bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-left shrink-0">
                 {/* Use the Interactive Sentence Helper here too */}
                 {renderInteractiveSentence()}
                 
                 <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                     <p className="text-sm text-zinc-500 font-medium italic">"{word.definition}"</p>
                 </div>
             </div>
         </div>

         {/* Simplified SRS Controls - Just 2 Buttons */}
         <div className="mt-auto pt-4 md:pt-6 shrink-0">
             <div className="grid grid-cols-2 gap-4 mb-2">
                <SRSButton 
                    label="Needs Practice" 
                    icon={<X size={16} />}
                    time={nextIntervals.again} 
                    color="text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/40 ring-orange-100 dark:ring-orange-900/20" 
                    onClick={() => onResult('again')} 
                />
                <SRSButton 
                    label="Got it" 
                    icon={<Check size={16} />}
                    time={nextIntervals.good} 
                    color="text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/40 ring-green-100 dark:ring-green-900/20" 
                    onClick={() => onResult('good')} 
                />
             </div>
         </div>
      </div>
  );

  return (
    <div className="relative h-full w-full max-w-md mx-auto bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl shadow-zinc-200/50 dark:shadow-black/50 border border-zinc-100 dark:border-zinc-800 overflow-hidden flex flex-col">
       {/* Main Card Content */}
       <div className={`flex-1 flex flex-col p-6 md:p-8 transition-opacity duration-300 overflow-hidden ${showAnswer ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
           {renderHeader()}
           {renderQuestion()}
           {renderInputArea()}
       </div>

       {/* Answer Overlay */}
       {showAnswer && renderAnswer()}
    </div>
  );
};

const SRSButton = ({ label, icon, time, color, onClick }: { label: string, icon?: React.ReactNode, time: string, color: string, onClick: () => void }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`flex flex-col items-center justify-center py-5 rounded-2xl border-2 active:scale-95 transition-all shadow-sm hover:shadow-md ${color}`}
  >
    <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="font-bold text-base">{label}</span>
    </div>
    <span className="text-xs opacity-70 font-semibold uppercase tracking-wide">{time}</span>
  </button>
);
