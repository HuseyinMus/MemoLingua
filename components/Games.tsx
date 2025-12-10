
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trophy, Gamepad2, X, Ghost, BrainCircuit, Grid, ArrowLeft, RotateCcw, Grid3x3, Shuffle, Sparkles, Check, Play, Timer, Lightbulb, FastForward, HelpCircle, Zap, Headphones, Volume2, Clock } from 'lucide-react';
import { LeaderboardEntry, UserProfile, UserWord } from '../types';

interface GamesProps {
    userProfile: UserProfile | null;
    words: UserWord[];
    onAddXP: (amount: number) => void;
    leaderboardData?: LeaderboardEntry[];
}

// --- COMMON COMPONENTS ---

const GameOverModal = ({ score, xp, onRestart, onExit, title = "Oyun Bitti" }: { score: number, xp: number, onRestart: () => void, onExit: () => void, title?: string }) => (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-fade-in">
        <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-slide-up">
            <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Trophy size={48} className="text-yellow-500" />
            </div>
            <h2 className="text-3xl font-black text-black dark:text-white mb-2">{title}</h2>
            <div className="flex justify-center gap-8 mb-8">
                <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Skor</p>
                    <p className="text-2xl font-black text-black dark:text-white">{score}</p>
                </div>
                <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Kazanılan XP</p>
                    <p className="text-2xl font-black text-green-500">+{xp}</p>
                </div>
            </div>
            <div className="space-y-3">
                <button onClick={onRestart} className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                    <RotateCcw size={18} /> Tekrar Oyna
                </button>
                <button onClick={onExit} className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white font-bold rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    Menüye Dön
                </button>
            </div>
        </div>
    </div>
);

// --- GAME LOGIC HELPERS ---

// 1. HANGMAN LOGIC
const useHangman = (words: UserWord[], onEnd: (score: number) => void) => {
    const [word, setWord] = useState<UserWord | null>(null);
    const [guessed, setGuessed] = useState<Set<string>>(new Set());
    const [lives, setLives] = useState(6);
    const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');

    const init = useCallback(() => {
        const list = words.length > 0 ? words : [{term:'Welcome', translation:'Hoşgeldin'} as any];
        const random = list[Math.floor(Math.random() * list.length)];
        setWord(random);
        setGuessed(new Set());
        setLives(6);
        setStatus('playing');
    }, [words]);

    useEffect(() => { init(); }, [init]);

    const guess = (char: string) => {
        if (status !== 'playing' || !word) return;
        const lowerChar = char.toLowerCase();
        if (guessed.has(lowerChar)) return;

        const newGuessed = new Set(guessed).add(lowerChar);
        setGuessed(newGuessed);

        if (!word.term.toLowerCase().includes(lowerChar)) {
            const newLives = lives - 1;
            setLives(newLives);
            if (newLives === 0) {
                setStatus('lost');
            }
        } else {
            const isWon = word.term.toLowerCase().split('').every(c => 
                !/[a-z]/.test(c) || newGuessed.has(c)
            );
            if (isWon) {
                setStatus('won');
                onEnd(50);
            }
        }
    };

    return { word, guessed, lives, status, guess, init };
};

// 2. SNAKE LOGIC
const GRID_SIZE = 20;
const useSnake = (onEnd: (score: number) => void) => {
    const [snake, setSnake] = useState<{x:number, y:number}[]>([{x: 10, y: 10}]);
    const [dir, setDir] = useState<{x:number, y:number}>({x: 1, y: 0});
    const [food, setFood] = useState<{x:number, y:number}>({x: 15, y: 10});
    const [score, setScore] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isGameOver, setIsGameOver] = useState(false);
    
    const init = useCallback(() => {
        setSnake([{x: 10, y: 10}]);
        setDir({x: 1, y: 0});
        setFood({x: 15, y: 10});
        setScore(0);
        setIsPaused(false);
        setIsGameOver(false);
    }, []);

    const moveSnake = useCallback(() => {
        if (isPaused || isGameOver) return;
        
        setSnake(prev => {
            const head = { ...prev[0] };
            head.x += dir.x;
            head.y += dir.y;

            // Collision Wall
            if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
                setIsGameOver(true);
                return prev;
            }

            // Collision Self
            if (prev.some(s => s.x === head.x && s.y === head.y)) {
                setIsGameOver(true);
                return prev;
            }

            const newSnake = [head, ...prev];
            
            // Eat Food
            if (head.x === food.x && head.y === food.y) {
                setScore(s => s + 10);
                setFood({
                    x: Math.floor(Math.random() * GRID_SIZE),
                    y: Math.floor(Math.random() * GRID_SIZE)
                });
            } else {
                newSnake.pop();
            }
            
            return newSnake;
        });
    }, [dir, food, isPaused, isGameOver]);

    useEffect(() => {
        const interval = setInterval(moveSnake, 150);
        return () => clearInterval(interval);
    }, [moveSnake]);

    return { snake, food, score, setDir, isPaused, setIsPaused, dir, isGameOver, init };
};

// 3. MEMORY MATCH LOGIC
interface MemoryCard {
    id: string;
    content: string;
    wordId: string;
    type: 'term' | 'translation';
    isFlipped: boolean;
    isMatched: boolean;
}

const useMemory = (words: UserWord[], onEnd: (score: number) => void) => {
    const [cards, setCards] = useState<MemoryCard[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [isChecking, setIsChecking] = useState(false);
    const [matches, setMatches] = useState(0);
    const [moves, setMoves] = useState(0);
    const [isGameOver, setIsGameOver] = useState(false);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [gameStarted, setGameStarted] = useState(false);

    const init = useCallback(() => {
        const list = words.length >= 6 ? words : [...words, ...words, ...words, ...words].slice(0, 6); 
        const selectedWords = list.sort(() => 0.5 - Math.random()).slice(0, 6);
        
        const generatedCards: MemoryCard[] = [];
        selectedWords.forEach(w => {
            generatedCards.push({ id: w.id + '-t', content: w.term, wordId: w.id, type: 'term', isFlipped: true, isMatched: false }); // Start flipped for peek
            generatedCards.push({ id: w.id + '-d', content: w.translation, wordId: w.id, type: 'translation', isFlipped: true, isMatched: false });
        });

        const shuffled = generatedCards.sort(() => 0.5 - Math.random());
        setCards(shuffled);
        setFlippedIndices([]);
        setMatches(0);
        setMoves(0);
        setIsGameOver(false);
        setIsChecking(true); // Disable clicks during peek
        setTimeElapsed(0);
        setGameStarted(false);

        // Peek phase
        setTimeout(() => {
            setCards(prev => prev.map(c => ({ ...c, isFlipped: false })));
            setIsChecking(false);
            setGameStarted(true);
        }, 2000);

    }, [words]);

    useEffect(() => { init(); }, [init]);

    useEffect(() => {
        let interval: any;
        if (gameStarted && !isGameOver) {
            interval = setInterval(() => setTimeElapsed(prev => prev + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [gameStarted, isGameOver]);

    const handleCardClick = (index: number) => {
        if (isChecking || isGameOver || cards[index].isFlipped || cards[index].isMatched || !gameStarted) return;

        const newCards = [...cards];
        newCards[index].isFlipped = true;
        setCards(newCards);

        const newFlipped = [...flippedIndices, index];
        setFlippedIndices(newFlipped);

        if (newFlipped.length === 2) {
            setIsChecking(true);
            setMoves(m => m + 1);
            const card1 = cards[newFlipped[0]];
            const card2 = cards[newFlipped[1]];

            if (card1.wordId === card2.wordId) {
                // Match
                setTimeout(() => {
                    const matchedCards = [...newCards];
                    matchedCards[newFlipped[0]].isMatched = true;
                    matchedCards[newFlipped[1]].isMatched = true;
                    setCards(matchedCards);
                    setFlippedIndices([]);
                    setIsChecking(false);
                    setMatches(m => {
                        const newM = m + 1;
                        if (newM === cards.length / 2) {
                            setIsGameOver(true);
                            // Score Calculation: Base 100 - (Moves * 2) - (Time / 2)
                            const finalScore = Math.max(10, 200 - (moves * 5) - (timeElapsed * 2));
                            onEnd(finalScore); 
                        }
                        return newM;
                    });
                }, 500);
            } else {
                // No Match
                setTimeout(() => {
                    const resetCards = [...newCards];
                    resetCards[newFlipped[0]].isFlipped = false;
                    resetCards[newFlipped[1]].isFlipped = false;
                    setCards(resetCards);
                    setFlippedIndices([]);
                    setIsChecking(false);
                }, 1000);
            }
        }
    };

    return { cards, handleCardClick, moves, isGameOver, init, timeElapsed };
};

// 4. WORD SCRAMBLE LOGIC
const useScramble = (words: UserWord[], onEnd: (score: number) => void) => {
    const [currentWord, setCurrentWord] = useState<UserWord | null>(null);
    const [scrambled, setScrambled] = useState('');
    const [input, setInput] = useState('');
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
    const [hintRevealed, setHintRevealed] = useState(false);

    const nextWord = useCallback(() => {
        const list = words.length > 0 ? words : [{term:'Apple', translation:'Elma'} as any];
        const random = list[Math.floor(Math.random() * list.length)];
        setCurrentWord(random);
        
        // Scramble logic
        const arr = random.term.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        setScrambled(arr.join('').toUpperCase());
        setInput('');
        setFeedback('none');
        setHintRevealed(false);
    }, [words]);

    useEffect(() => { nextWord(); }, [nextWord]);

    const check = () => {
        if (!currentWord) return;
        if (input.trim().toLowerCase() === currentWord.term.toLowerCase()) {
            setFeedback('correct');
            const points = 20 + (streak * 5) - (hintRevealed ? 10 : 0);
            setScore(s => s + Math.max(5, points));
            setStreak(s => s + 1);
            setTimeout(() => {
                nextWord();
            }, 1000);
        } else {
            setFeedback('wrong');
            setStreak(0);
            setTimeout(() => setFeedback('none'), 800);
        }
    };

    const useHint = () => {
        if (!hintRevealed) {
            setHintRevealed(true);
            setScore(s => Math.max(0, s - 5)); // Cost for hint
            setInput(currentWord?.term.charAt(0) || '');
        }
    };

    return { currentWord, scrambled, input, setInput, check, score, feedback, nextWord, streak, hintRevealed, useHint };
};

// 5. SPEED QUIZ LOGIC (Hızlı Cevap)
const useSpeedQuiz = (words: UserWord[], onEnd: (score: number) => void) => {
    const [currentWord, setCurrentWord] = useState<UserWord | null>(null);
    const [options, setOptions] = useState<UserWord[]>([]);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(30);
    const [isGameOver, setIsGameOver] = useState(false);
    const [gameState, setGameState] = useState<'playing' | 'idle'>('idle');

    const generateQuestion = useCallback(() => {
        if (words.length < 4) {
            // Need at least 4 words
            setIsGameOver(true);
            return;
        }
        const target = words[Math.floor(Math.random() * words.length)];
        const distractors = words.filter(w => w.id !== target.id).sort(() => 0.5 - Math.random()).slice(0, 3);
        const allOptions = [target, ...distractors].sort(() => 0.5 - Math.random());
        
        setCurrentWord(target);
        setOptions(allOptions);
    }, [words]);

    const init = useCallback(() => {
        setScore(0);
        setTimeLeft(30);
        setIsGameOver(false);
        setGameState('playing');
        generateQuestion();
    }, [generateQuestion]);

    const handleAnswer = (selectedId: string) => {
        if (!currentWord || isGameOver) return;
        
        if (selectedId === currentWord.id) {
            setScore(s => s + 10);
            setTimeLeft(t => Math.min(30, t + 2)); // Bonus time
            generateQuestion();
        } else {
            setTimeLeft(t => Math.max(0, t - 5)); // Penalty
            // Visual feedback could be added here
        }
    };

    useEffect(() => {
        if (gameState !== 'playing') return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setIsGameOver(true);
                    onEnd(score);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [gameState, onEnd, score]);

    useEffect(() => { init(); }, [init]);

    return { currentWord, options, score, timeLeft, isGameOver, handleAnswer, init };
};

// 6. AUDIO CHALLENGE LOGIC (Dinleme Testi)
const useAudioQuiz = (words: UserWord[], onEnd: (score: number) => void) => {
    const [currentWord, setCurrentWord] = useState<UserWord | null>(null);
    const [options, setOptions] = useState<UserWord[]>([]);
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [isGameOver, setIsGameOver] = useState(false);
    
    const generateQuestion = useCallback(() => {
        if (words.length < 4) return;
        const target = words[Math.floor(Math.random() * words.length)];
        const distractors = words.filter(w => w.id !== target.id).sort(() => 0.5 - Math.random()).slice(0, 3);
        const allOptions = [target, ...distractors].sort(() => 0.5 - Math.random());
        
        setCurrentWord(target);
        setOptions(allOptions);
        
        // Auto play audio
        setTimeout(() => playAudio(target.term), 500);
    }, [words]);

    const init = useCallback(() => {
        setScore(0);
        setLives(3);
        setIsGameOver(false);
        generateQuestion();
    }, [generateQuestion]);

    const playAudio = (text: string) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    const handleAnswer = (selectedId: string) => {
        if (!currentWord || isGameOver) return;

        if (selectedId === currentWord.id) {
            setScore(s => s + 10);
            generateQuestion();
        } else {
            setLives(l => {
                const newLives = l - 1;
                if (newLives <= 0) {
                    setIsGameOver(true);
                    onEnd(score);
                }
                return newLives;
            });
        }
    };

    useEffect(() => { init(); }, [init]);

    return { currentWord, options, score, lives, isGameOver, handleAnswer, playAudio, init };
};


export const Games: React.FC<GamesProps> = ({ userProfile, words, onAddXP, leaderboardData }) => {
    const [activeTab, setActiveTab] = useState<'menu' | 'leaderboard'>('menu');
    const [activeGame, setActiveGame] = useState<'none' | 'hangman' | 'snake' | 'memory' | 'scramble' | 'speed' | 'audio'>('none');
    
    // --- HANGMAN RENDER ---
    const HangmanGame = () => {
        const { word, guessed, lives, status, guess, init } = useHangman(words, (points) => onAddXP(points));
        
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in relative">
                <button 
                    onClick={() => setActiveGame('none')} 
                    className="absolute top-4 left-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors z-20 shadow-sm"
                >
                    <ArrowLeft size={20} className="text-black dark:text-white" />
                </button>

                <div className="mb-8 relative">
                    <svg width="120" height="160" viewBox="0 0 120 160" className="stroke-black dark:stroke-white stroke-2 fill-none">
                        <line x1="10" y1="150" x2="110" y2="150" />
                        <line x1="60" y1="150" x2="60" y2="20" />
                        <line x1="60" y1="20" x2="100" y2="20" />
                        <line x1="100" y1="20" x2="100" y2="40" />
                        {lives <= 5 && <circle cx="100" cy="50" r="10" />}
                        {lives <= 4 && <line x1="100" y1="60" x2="100" y2="100" />}
                        {lives <= 3 && <line x1="100" y1="70" x2="80" y2="90" />}
                        {lives <= 2 && <line x1="100" y1="70" x2="120" y2="90" />}
                        {lives <= 1 && <line x1="100" y1="100" x2="80" y2="130" />}
                        {lives === 0 && <line x1="100" y1="100" x2="120" y2="130" />}
                    </svg>
                </div>

                <div className="text-3xl font-mono tracking-[0.5em] font-bold mb-4 text-center break-all">
                    {word?.term.split('').map((char: string, i: number) => (
                        <span key={i} className="border-b-2 border-zinc-300 dark:border-zinc-700 mx-1 inline-block min-w-[1rem] h-8">
                            {guessed.has(char.toLowerCase()) || status !== 'playing' ? char : ''}
                        </span>
                    ))}
                </div>
                
                {status === 'playing' && (
                    <div className="text-zinc-500 mb-8 font-medium bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-xl">İpucu: {word?.translation}</div>
                )}

                {status !== 'playing' && (
                    <GameOverModal 
                        title={status === 'won' ? 'Kazandın!' : 'Kaybettin'}
                        score={status === 'won' ? 50 : 0}
                        xp={status === 'won' ? 50 : 0}
                        onRestart={init}
                        onExit={() => setActiveGame('none')}
                    />
                )}
                
                {status === 'playing' && (
                    <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                        {'abcdefghijklmnopqrstuvwxyz'.split('').map(char => (
                            <button
                                key={char}
                                onClick={() => guess(char)}
                                disabled={guessed.has(char)}
                                className={`w-10 h-10 rounded-lg font-bold text-lg transition-all ${
                                    guessed.has(char) 
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-600' 
                                        : 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm hover:scale-105 active:scale-95 border-b-4 border-zinc-200 dark:border-zinc-600 active:border-b-0 active:translate-y-1'
                                }`}
                            >
                                {char.toUpperCase()}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // --- SNAKE RENDER ---
    const SnakeGame = () => {
        const { snake, food, score, setDir, isPaused, isGameOver, init } = useSnake((s) => onAddXP(Math.floor(s/2)));
        
        const handleTouch = (d: string) => {
            if (d === 'UP') setDir(prev => prev.y !== 1 ? {x: 0, y: -1} : prev);
            if (d === 'DOWN') setDir(prev => prev.y !== -1 ? {x: 0, y: 1} : prev);
            if (d === 'LEFT') setDir(prev => prev.x !== 1 ? {x: -1, y: 0} : prev);
            if (d === 'RIGHT') setDir(prev => prev.x !== -1 ? {x: 1, y: 0} : prev);
        };

        return (
            <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in overflow-hidden">
                <div className="flex items-center justify-between w-full max-w-xs mb-6">
                    <button 
                        onClick={() => setActiveGame('none')} 
                        className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-black dark:text-white transition-colors"
                    >
                        <ArrowLeft size={20}/>
                    </button>
                    <div className="font-bold text-xl text-black dark:text-white bg-white dark:bg-zinc-800 px-4 py-2 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                        Score: {score}
                    </div>
                    <div className="w-10"></div> 
                </div>

                <div className="relative bg-zinc-200 dark:bg-zinc-800 rounded-xl border-4 border-zinc-300 dark:border-zinc-700 w-[300px] h-[300px] shadow-inner">
                    {isGameOver && (
                        <GameOverModal 
                            title="Oyun Bitti"
                            score={score}
                            xp={Math.floor(score/2)}
                            onRestart={init}
                            onExit={() => setActiveGame('none')}
                        />
                    )}
                    {snake.map((seg, i) => (
                        <div 
                            key={i} 
                            className={`absolute w-[15px] h-[15px] rounded-sm z-10 ${i===0 ? 'bg-green-600' : 'bg-green-500'}`}
                            style={{ left: seg.x * 15, top: seg.y * 15 }}
                        />
                    ))}
                    <div 
                        className="absolute w-[15px] h-[15px] bg-red-500 rounded-full animate-pulse z-0 flex items-center justify-center"
                        style={{ left: food.x * 15, top: food.y * 15 }}
                    >
                        <div className="w-1 h-1 bg-white rounded-full opacity-50"></div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-8">
                    <div></div>
                    <button onClick={() => handleTouch('UP')} className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center active:bg-zinc-300 text-black dark:text-white text-2xl font-bold shadow-sm border-b-4 border-zinc-300 dark:border-zinc-600 active:border-b-0 active:translate-y-1">↑</button>
                    <div></div>
                    <button onClick={() => handleTouch('LEFT')} className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center active:bg-zinc-300 text-black dark:text-white text-2xl font-bold shadow-sm border-b-4 border-zinc-300 dark:border-zinc-600 active:border-b-0 active:translate-y-1">←</button>
                    <button onClick={() => handleTouch('DOWN')} className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center active:bg-zinc-300 text-black dark:text-white text-2xl font-bold shadow-sm border-b-4 border-zinc-300 dark:border-zinc-600 active:border-b-0 active:translate-y-1">↓</button>
                    <button onClick={() => handleTouch('RIGHT')} className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center active:bg-zinc-300 text-black dark:text-white text-2xl font-bold shadow-sm border-b-4 border-zinc-300 dark:border-zinc-600 active:border-b-0 active:translate-y-1">→</button>
                </div>
            </div>
        );
    };

    // --- MEMORY MATCH RENDER ---
    const MemoryGame = () => {
        const { cards, handleCardClick, moves, isGameOver, init, timeElapsed } = useMemory(words, (s) => onAddXP(s));

        return (
            <div className="flex flex-col items-center h-full p-4 animate-fade-in relative">
                <div className="flex items-center justify-between w-full max-w-sm mb-6 shrink-0 bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                    <button onClick={() => setActiveGame('none')} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200"><ArrowLeft size={20} className="text-black dark:text-white"/></button>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 text-black dark:text-white font-bold">
                            <Gamepad2 size={16} className="text-zinc-400" /> {moves}
                        </div>
                        <div className="flex items-center gap-1.5 text-black dark:text-white font-bold">
                            <Timer size={16} className="text-zinc-400" /> {timeElapsed}s
                        </div>
                    </div>
                    <button onClick={init} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200"><RotateCcw size={20} className="text-black dark:text-white"/></button>
                </div>

                {isGameOver ? (
                    <GameOverModal 
                        title="Hafıza Ustası"
                        score={Math.max(10, 200 - (moves * 5) - (timeElapsed * 2))}
                        xp={Math.max(10, 200 - (moves * 5) - (timeElapsed * 2))}
                        onRestart={init}
                        onExit={() => setActiveGame('none')}
                    />
                ) : (
                    <div className="grid grid-cols-3 gap-3 w-full max-w-sm flex-1 overflow-y-auto content-start py-4">
                        {cards.map((card, index) => (
                            <button
                                key={index}
                                onClick={() => handleCardClick(index)}
                                className={`aspect-[3/4] rounded-xl flex items-center justify-center p-2 text-center text-xs md:text-sm font-bold shadow-lg transition-all duration-500 transform perspective-1000 ${
                                    card.isFlipped || card.isMatched 
                                        ? 'bg-white dark:bg-zinc-800 text-black dark:text-white rotate-y-0 border-b-4 border-zinc-200 dark:border-zinc-700' 
                                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-transparent rotate-y-180 border-b-4 border-indigo-700'
                                }`}
                                disabled={card.isMatched}
                                style={{ transformStyle: 'preserve-3d' }}
                            >
                                {(card.isFlipped || card.isMatched) ? (
                                    <span className="animate-fade-in">{card.content}</span>
                                ) : (
                                    <Sparkles className="text-white/30" size={24} />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // --- WORD SCRAMBLE RENDER ---
    const ScrambleGame = () => {
        const { currentWord, scrambled, input, setInput, check, score, feedback, nextWord, streak, useHint } = useScramble(words, (s) => onAddXP(s));

        return (
            <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in relative max-w-sm mx-auto">
                 <button onClick={() => { onAddXP(score); setActiveGame('none'); }} className="absolute top-4 left-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full"><ArrowLeft size={20} className="text-black dark:text-white"/></button>
                 
                 <div className="flex justify-between items-center w-full mb-8 px-4">
                     <div className="text-center">
                         <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Seri</div>
                         <div className="text-2xl font-black text-orange-500 flex items-center justify-center gap-1"><Sparkles size={16} fill="currentColor"/> {streak}</div>
                     </div>
                     <div className="text-center">
                         <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Skor</div>
                         <div className="text-3xl font-black text-black dark:text-white">{score}</div>
                     </div>
                 </div>

                 <div className="w-full bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 shadow-xl border border-zinc-100 dark:border-zinc-800 text-center relative overflow-hidden transition-all duration-300">
                     {feedback === 'correct' && <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center z-10"><Check size={80} className="text-green-500 animate-bounce" /></div>}
                     {feedback === 'wrong' && <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center z-10"><X size={80} className="text-red-500 animate-shake" /></div>}
                     
                     <div className="mb-6 flex flex-wrap justify-center gap-2">
                        {scrambled.split('').map((char, i) => (
                            <div key={i} className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm border-b-2 border-zinc-200 dark:border-zinc-700">
                                {char}
                            </div>
                        ))}
                     </div>
                     
                     <p className="text-sm text-zinc-500 mb-6 italic bg-zinc-50 dark:bg-zinc-800/50 py-2 px-4 rounded-xl inline-block">"{currentWord?.translation}"</p>
                     
                     <div className="relative">
                        <input 
                            type="text" 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && check()}
                            className="w-full bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl text-center text-xl font-bold uppercase tracking-wider outline-none border-2 border-transparent focus:border-blue-500 mb-4 text-black dark:text-white transition-all"
                            placeholder="Kelimeyi Yaz"
                            autoComplete="off"
                        />
                        <button 
                            onClick={useHint} 
                            className="absolute right-3 top-3 p-2 text-zinc-400 hover:text-yellow-500 transition-colors"
                            title="İpucu (5 Puan)"
                        >
                            <Lightbulb size={20} />
                        </button>
                     </div>
                     
                     <div className="flex gap-3 mt-2">
                         <button onClick={nextWord} className="flex-1 py-4 text-zinc-400 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors flex items-center justify-center gap-2">
                             <FastForward size={16}/> Pas Geç
                         </button>
                         <button onClick={check} className="flex-[2] py-4 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all">
                             Kontrol Et
                         </button>
                     </div>
                 </div>
            </div>
        )
    }

    // --- SPEED QUIZ RENDER ---
    const SpeedQuizGame = () => {
        const { currentWord, options, score, timeLeft, isGameOver, handleAnswer, init } = useSpeedQuiz(words, (s) => onAddXP(s));

        return (
            <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in relative max-w-sm mx-auto">
                <button onClick={() => { onAddXP(score); setActiveGame('none'); }} className="absolute top-4 left-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full"><ArrowLeft size={20} className="text-black dark:text-white"/></button>
                
                <div className="flex justify-between items-center w-full mb-8 px-2">
                    <div className="flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 px-4 py-2 rounded-full text-orange-600 dark:text-orange-400 font-bold">
                        <Clock size={16} /> {timeLeft}s
                    </div>
                    <div className="text-2xl font-black text-black dark:text-white">{score}</div>
                </div>

                {isGameOver ? (
                    <GameOverModal title="Süre Bitti" score={score} xp={score} onRestart={init} onExit={() => setActiveGame('none')} />
                ) : (
                    <div className="w-full">
                        <div className="text-center mb-10">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Bu kelimenin anlamı ne?</p>
                            <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter">{currentWord?.term}</h2>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {options.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => handleAnswer(opt.id)}
                                    className="w-full py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-lg font-bold text-zinc-700 dark:text-zinc-200 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    {opt.translation}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- AUDIO CHALLENGE RENDER ---
    const AudioQuizGame = () => {
        const { currentWord, options, score, lives, isGameOver, handleAnswer, playAudio, init } = useAudioQuiz(words, (s) => onAddXP(s));

        return (
            <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in relative max-w-sm mx-auto">
                <button onClick={() => { onAddXP(score); setActiveGame('none'); }} className="absolute top-4 left-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full"><ArrowLeft size={20} className="text-black dark:text-white"/></button>
                
                <div className="flex justify-between items-center w-full mb-8 px-2">
                    <div className="flex gap-1">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className={`w-3 h-3 rounded-full ${i < lives ? 'bg-red-500' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
                        ))}
                    </div>
                    <div className="text-2xl font-black text-black dark:text-white">{score}</div>
                </div>

                {isGameOver ? (
                    <GameOverModal title="Oyun Bitti" score={score} xp={score} onRestart={init} onExit={() => setActiveGame('none')} />
                ) : (
                    <div className="w-full text-center">
                        <button 
                            onClick={() => currentWord && playAudio(currentWord.term)}
                            className="w-32 h-32 rounded-full bg-blue-500 text-white flex items-center justify-center mx-auto mb-10 shadow-xl shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all"
                        >
                            <Volume2 size={48} />
                        </button>
                        
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-6">Duyduğun kelimeyi seç</p>

                        <div className="grid grid-cols-1 gap-3">
                            {options.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => handleAnswer(opt.id)}
                                    className="w-full py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-lg font-bold text-zinc-700 dark:text-zinc-200 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    {opt.translation}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- LEADERBOARD RENDER ---
    if (activeTab === 'leaderboard') {
        return (
            <div className="h-full overflow-y-auto px-6 pt-12 pb-28 scrollbar-hide">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-black dark:text-white">Liderlik</h2>
                        <p className="text-zinc-500">En iyiler listesi</p>
                    </div>
                    <button onClick={() => setActiveTab('menu')} className="p-3 rounded-full bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white"><ArrowLeft /></button>
                </header>
                
                <div className="space-y-3">
                     {leaderboardData?.map((entry) => (
                         <div key={entry.id} className={`flex items-center gap-4 p-4 rounded-2xl border ${entry.isCurrentUser ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-black dark:text-white'}`}>
                             <div className="font-bold font-mono text-lg w-8 text-center">{entry.rank}</div>
                             <div className="text-2xl">{entry.avatar}</div>
                             <div className="flex-1 font-bold">{entry.name}</div>
                             <div className="font-mono opacity-60 text-sm">{entry.xp} XP</div>
                         </div>
                     ))}
                     {!leaderboardData?.length && (
                         <div className="text-center py-10 text-zinc-400">Yükleniyor...</div>
                     )}
                </div>
            </div>
        );
    }

    // --- MENU RENDER ---
    if (activeGame !== 'none') {
        if (activeGame === 'hangman') return <HangmanGame />;
        if (activeGame === 'snake') return <SnakeGame />;
        if (activeGame === 'memory') return <MemoryGame />;
        if (activeGame === 'scramble') return <ScrambleGame />;
        if (activeGame === 'speed') return <SpeedQuizGame />;
        if (activeGame === 'audio') return <AudioQuizGame />;
        return null;
    }

    return (
        <div className="h-full flex flex-col px-6 pt-12 pb-28 overflow-y-auto scrollbar-hide bg-zinc-50 dark:bg-zinc-950">
            <header className="mb-8 flex justify-between items-start">
                <div>
                    <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-2">Oyun Alanı</h2>
                    <p className="text-zinc-500 font-medium">Öğrenirken eğlen.</p>
                </div>
                <button 
                    onClick={() => setActiveTab('leaderboard')}
                    className="flex flex-col items-center justify-center w-14 h-14 bg-yellow-400 text-yellow-900 rounded-2xl shadow-lg shadow-yellow-500/20 active:scale-95 transition-transform"
                >
                    <Trophy size={24} fill="currentColor" />
                </button>
            </header>

            <div className="grid grid-cols-1 gap-6 pb-6">
                <button 
                    onClick={() => setActiveGame('hangman')}
                    className="relative overflow-hidden group bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] text-left border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-500">
                        <Ghost size={120} className="text-black dark:text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-black dark:bg-white rounded-2xl flex items-center justify-center text-white dark:text-black mb-4 shadow-lg">
                            <BrainCircuit size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-black dark:text-white mb-1">Adam Asmaca</h3>
                        <p className="text-zinc-500 text-sm font-medium">Kelimeyi tahmin et, puanları topla.</p>
                    </div>
                </button>

                <button 
                    onClick={() => setActiveGame('snake')}
                    className="relative overflow-hidden group bg-gradient-to-br from-green-500 to-emerald-700 p-6 rounded-[2.5rem] text-left shadow-lg hover:shadow-green-500/30 transition-all"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform duration-500">
                        <Gamepad2 size={120} className="text-white" />
                    </div>
                    <div className="relative z-10">
                         <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white mb-4 border border-white/30">
                            <Grid size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-1">Kelime Yılanı</h3>
                        <p className="text-green-100 text-sm font-medium">Reflekslerini ve kelime bilgini test et.</p>
                    </div>
                </button>

                <button 
                    onClick={() => setActiveGame('memory')}
                    className="relative overflow-hidden group bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-[2.5rem] text-left shadow-lg hover:shadow-blue-500/30 transition-all"
                >
                     <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform duration-500">
                        <Grid3x3 size={120} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white mb-4 border border-white/30">
                            <Sparkles size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-1">Hafıza Kartları</h3>
                        <p className="text-blue-100 text-sm font-medium">Kelimeleri eşleştir, hafızanı güçlendir.</p>
                    </div>
                </button>

                <button 
                    onClick={() => setActiveGame('scramble')}
                    className="relative overflow-hidden group bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] text-left border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-10 -rotate-12 group-hover:rotate-0 transition-transform duration-500">
                        <Shuffle size={120} className="text-black dark:text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg">
                            <Shuffle size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-black dark:text-white mb-1">Kelime Karıştırma</h3>
                        <p className="text-zinc-500 text-sm font-medium">Karışık harfleri düzelt, doğruyu bul.</p>
                    </div>
                </button>

                <button 
                    onClick={() => setActiveGame('speed')}
                    className="relative overflow-hidden group bg-gradient-to-br from-yellow-400 to-orange-500 p-6 rounded-[2.5rem] text-left shadow-lg hover:shadow-yellow-500/30 transition-all"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform duration-500">
                        <Zap size={120} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white mb-4 border border-white/30">
                            <Zap size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-1">Hızlı Cevap</h3>
                        <p className="text-yellow-100 text-sm font-medium">Zamana karşı yarış, doğruyu seç.</p>
                    </div>
                </button>

                <button 
                    onClick={() => setActiveGame('audio')}
                    className="relative overflow-hidden group bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] text-left border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-500">
                        <Headphones size={120} className="text-black dark:text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg">
                            <Headphones size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-black dark:text-white mb-1">Dinleme Testi</h3>
                        <p className="text-zinc-500 text-sm font-medium">Kelimeyi dinle ve doğruyu bul.</p>
                    </div>
                </button>
            </div>
        </div>
    );
};
