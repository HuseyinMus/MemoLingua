
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trophy, Gamepad2, X, Ghost, BrainCircuit, Grid, ArrowLeft, RotateCcw, Grid3x3, Shuffle, Sparkles, Check, Play, Timer, Lightbulb, FastForward, HelpCircle, Zap, Headphones, Volume2, Clock, Flame, Heart, AlertTriangle } from 'lucide-react';
import { LeaderboardEntry, UserProfile, UserWord } from '../types';

interface GamesProps {
    userProfile: UserProfile | null;
    words: UserWord[];
    onAddXP: (amount: number) => void;
    leaderboardData?: LeaderboardEntry[];
}

// --- COMMON COMPONENTS ---

const GameOverModal = ({ 
    score, 
    xp, 
    onRestart, 
    onExit, 
    isWin = true,
    title = "Oyun Bitti", 
    subTitle = "İyi iş çıkardın!" 
}: { 
    score: number, 
    xp: number, 
    onRestart: () => void, 
    onExit: () => void, 
    isWin?: boolean,
    title?: string, 
    subTitle?: string 
}) => (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fade-in">
        <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-slide-up">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner relative overflow-hidden ${isWin ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                <div className={`absolute inset-0 bg-gradient-to-tr from-transparent animate-pulse ${isWin ? 'via-green-400/20' : 'via-red-400/20'}`}></div>
                {isWin ? (
                    <Trophy size={48} className="text-green-600 dark:text-green-400 relative z-10" />
                ) : (
                    <AlertTriangle size={48} className="text-red-600 dark:text-red-400 relative z-10" />
                )}
            </div>
            
            <h2 className={`text-3xl font-black mb-1 ${isWin ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isWin ? 'KAZANDIN!' : 'KAYBETTİN!'}
            </h2>
            <p className="text-zinc-500 text-sm mb-8 font-medium">{subTitle}</p>
            
            <div className="flex justify-center gap-4 mb-8 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex-1 border-r border-zinc-200 dark:border-zinc-700 pr-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Skor</p>
                    <p className="text-3xl font-black text-black dark:text-white leading-none">{score}</p>
                </div>
                <div className="flex-1 pl-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">XP Değişimi</p>
                    <p className={`text-3xl font-black leading-none ${xp >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {xp > 0 ? `+${xp}` : xp}
                    </p>
                </div>
            </div>
            
            <div className="space-y-3">
                <button onClick={onRestart} className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                    <RotateCcw size={18} /> Tekrar Oyna
                </button>
                <button onClick={onExit} className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white font-bold rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    Arena Menüsüne Dön
                </button>
            </div>
        </div>
    </div>
);

// --- GAME LOGIC HELPERS ---

// 1. HANGMAN LOGIC
const useHangman = (words: UserWord[], onEnd: (score: number, isWin: boolean) => void) => {
    const [word, setWord] = useState<UserWord | null>(null);
    const [guessed, setGuessed] = useState<Set<string>>(new Set());
    const [lives, setLives] = useState(6);
    const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');

    const init = useCallback(() => {
        const list = words.length > 0 ? words : [{term:'Welcome', translation:'Hoşgeldin', pronunciation: 'wel-kum'} as any];
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
                onEnd(0, false);
            }
        } else {
            const isWon = word.term.toLowerCase().split('').every(c => 
                !/[a-z]/.test(c) || newGuessed.has(c)
            );
            if (isWon) {
                setStatus('won');
                onEnd(50, true);
            }
        }
    };

    return { word, guessed, lives, status, guess, init };
};

// 2. SNAKE LOGIC (Educational Version)
const GRID_SIZE = 20;
const useSnake = (words: UserWord[], onEnd: (score: number, isWin: boolean) => void) => {
    const [snake, setSnake] = useState<{x:number, y:number}[]>([{x: 10, y: 10}]);
    const [dir, setDir] = useState<{x:number, y:number}>({x: 1, y: 0});
    const [food, setFood] = useState<{x:number, y:number}>({x: 15, y: 10});
    const [score, setScore] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isGameOver, setIsGameOver] = useState(false);
    
    // Educational State
    const [currentWord, setCurrentWord] = useState<UserWord | null>(null);
    const [lettersRevealed, setLettersRevealed] = useState(0);

    const pickNewWord = useCallback(() => {
        const list = words.length > 0 ? words : [{term:'Apple', translation:'Elma'} as any];
        const random = list[Math.floor(Math.random() * list.length)];
        setCurrentWord(random);
        setLettersRevealed(0);
    }, [words]);
    
    const init = useCallback(() => {
        setSnake([{x: 10, y: 10}]);
        setDir({x: 1, y: 0});
        setFood({x: 15, y: 10});
        setScore(0);
        setIsPaused(false);
        setIsGameOver(false);
        pickNewWord();
    }, [pickNewWord]);

    const moveSnake = useCallback(() => {
        if (isPaused || isGameOver || !currentWord) return;
        
        setSnake(prev => {
            const head = { ...prev[0] };
            head.x += dir.x;
            head.y += dir.y;

            // Collision Wall or Self
            if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE || prev.some(s => s.x === head.x && s.y === head.y)) {
                setIsGameOver(true);
                onEnd(score, score > 20); // Win if score > 20
                return prev;
            }

            const newSnake = [head, ...prev];
            
            // Eat Food
            if (head.x === food.x && head.y === food.y) {
                setLettersRevealed(prev => {
                    const next = prev + 1;
                    if (next >= currentWord.term.length) {
                        setScore(s => s + 50); 
                        setTimeout(() => pickNewWord(), 100);
                        return 0; 
                    }
                    return next;
                });
                
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
    }, [dir, food, isPaused, isGameOver, currentWord, pickNewWord, score, onEnd]);

    useEffect(() => {
        const interval = setInterval(moveSnake, 150);
        return () => clearInterval(interval);
    }, [moveSnake]);

    useEffect(() => {
        if(!currentWord) pickNewWord();
    }, []);

    return { snake, food, score, setDir, isPaused, setIsPaused, dir, isGameOver, init, currentWord, lettersRevealed };
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

const useMemory = (words: UserWord[], onEnd: (score: number, isWin: boolean) => void) => {
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
            generatedCards.push({ id: w.id + '-t', content: w.term, wordId: w.id, type: 'term', isFlipped: true, isMatched: false }); 
            generatedCards.push({ id: w.id + '-d', content: w.translation, wordId: w.id, type: 'translation', isFlipped: true, isMatched: false });
        });

        const shuffled = generatedCards.sort(() => 0.5 - Math.random());
        setCards(shuffled);
        setFlippedIndices([]);
        setMatches(0);
        setMoves(0);
        setIsGameOver(false);
        setIsChecking(true); 
        setTimeElapsed(0);
        setGameStarted(false);

        setTimeout(() => {
            setCards(prev => prev.map(c => ({ ...c, isFlipped: false })));
            setIsChecking(false);
            setGameStarted(true);
        }, 2500);

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
                            const finalScore = Math.max(10, 300 - (moves * 10) - (timeElapsed * 2));
                            onEnd(finalScore, true); 
                        }
                        return newM;
                    });
                }, 500);
            } else {
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

    return { cards, handleCardClick, moves, isGameOver, init, timeElapsed, gameStarted, matches };
};

// 4. WORD SCRAMBLE LOGIC
interface Tile {
    id: string;
    char: string;
    status: 'pool' | 'placed';
}

const useScramble = (words: UserWord[], onEnd: (score: number, isWin: boolean) => void) => {
    const [currentWord, setCurrentWord] = useState<UserWord | null>(null);
    const [tiles, setTiles] = useState<Tile[]>([]);
    const [placedTiles, setPlacedTiles] = useState<Tile[]>([]);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);
    const [isGameOver, setIsGameOver] = useState(false);
    const [streak, setStreak] = useState(0);
    const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
    const [hintUsed, setHintUsed] = useState(false);

    const nextWord = useCallback(() => {
        const list = words.length > 0 ? words : [{term:'Banana', translation:'Muz'} as any];
        const random = list[Math.floor(Math.random() * list.length)];
        setCurrentWord(random);
        
        const chars = random.term.toUpperCase().split('').map((c, i) => ({
            id: `tile-${i}-${c}`,
            char: c,
            status: 'pool' as const
        }));
        
        for (let i = chars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        
        setTiles(chars);
        setPlacedTiles([]);
        setFeedback('none');
        setHintUsed(false);
    }, [words]);

    const init = useCallback(() => {
        setScore(0);
        setTimeLeft(60);
        setIsGameOver(false);
        setStreak(0);
        nextWord();
    }, [nextWord]);

    useEffect(() => {
        if (isGameOver) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setIsGameOver(true);
                    onEnd(score, score > 50);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [isGameOver, score, onEnd]);

    const handleTileClick = (tile: Tile) => {
        if (feedback !== 'none' || isGameOver) return;
        if (tile.status === 'pool') {
            const newTiles = tiles.map(t => t.id === tile.id ? { ...t, status: 'placed' as const } : t);
            setTiles(newTiles);
            setPlacedTiles(prev => [...prev, { ...tile, status: 'placed' }]);
        } else {
            const newPlaced = placedTiles.filter(t => t.id !== tile.id);
            setPlacedTiles(newPlaced);
            const newTiles = tiles.map(t => t.id === tile.id ? { ...t, status: 'pool' as const } : t);
            setTiles(newTiles);
        }
    };

    useEffect(() => {
        if (currentWord && placedTiles.length === currentWord.term.length) {
            const attempt = placedTiles.map(t => t.char).join('');
            if (attempt === currentWord.term.toUpperCase()) {
                setFeedback('correct');
                const points = 20 + (streak * 5) - (hintUsed ? 10 : 0);
                setScore(s => s + Math.max(5, points));
                setStreak(s => s + 1);
                setTimeout(() => nextWord(), 1000);
            } else {
                setFeedback('wrong');
                setStreak(0);
                setTimeout(() => {
                    setPlacedTiles([]);
                    setTiles(prev => prev.map(t => ({ ...t, status: 'pool' })));
                    setFeedback('none');
                }, 800);
            }
        }
    }, [placedTiles, currentWord, streak, hintUsed, nextWord]);

    return { currentWord, tiles, placedTiles, handleTileClick, score, feedback, nextWord, streak, timeLeft, isGameOver, init };
};

// 5. SPEED QUIZ LOGIC
const useSpeedQuiz = (words: UserWord[], onEnd: (score: number, isWin: boolean) => void) => {
    const [currentWord, setCurrentWord] = useState<UserWord | null>(null);
    const [options, setOptions] = useState<UserWord[]>([]);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(30);
    const [isGameOver, setIsGameOver] = useState(false);
    const [combo, setCombo] = useState(0);
    const [lastResult, setLastResult] = useState<'correct' | 'wrong' | null>(null);

    const generateQuestion = useCallback(() => {
        if (words.length < 4) {
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
        setCombo(0);
        setIsGameOver(false);
        setLastResult(null);
        generateQuestion();
    }, [generateQuestion]);

    const handleAnswer = (selectedId: string) => {
        if (!currentWord || isGameOver) return;
        
        if (selectedId === currentWord.id) {
            const points = 10 * (1 + (combo * 0.1));
            setScore(s => s + Math.round(points));
            setTimeLeft(t => Math.min(30, t + 2)); 
            setCombo(c => c + 1);
            setLastResult('correct');
            setTimeout(() => {
                setLastResult(null);
                generateQuestion();
            }, 300);
        } else {
            setTimeLeft(t => Math.max(0, t - 5));
            setCombo(0);
            setLastResult('wrong');
            setTimeout(() => setLastResult(null), 300);
        }
    };

    useEffect(() => {
        if (isGameOver) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setIsGameOver(true);
                    onEnd(score, score > 50);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [isGameOver, onEnd, score]);

    useEffect(() => { init(); }, [init]);

    return { currentWord, options, score, timeLeft, isGameOver, handleAnswer, init, combo, lastResult };
};

// 6. AUDIO CHALLENGE LOGIC
const useAudioQuiz = (words: UserWord[], onEnd: (score: number, isWin: boolean) => void) => {
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
        setTimeout(() => playAudio(target.term), 400);
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
                    onEnd(score, score >= 30);
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
        const { word, guessed, lives, status, guess, init } = useHangman(words, (points, isWin) => {
            onAddXP(isWin ? points : -10); // Deduct 10 XP on loss
        });
        
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in relative overflow-hidden">
                <button onClick={() => setActiveGame('none')} className="absolute top-4 left-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 z-10"><ArrowLeft size={20} className="text-black dark:text-white" /></button>

                <div className="mb-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Kelimeyi Tahmin Et</p>
                </div>

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

                <div className="text-3xl font-mono tracking-[0.5em] font-bold mb-6 text-center break-all">
                    {word?.term.split('').map((char: string, i: number) => (
                        <span key={i} className="border-b-2 border-zinc-300 dark:border-zinc-700 mx-1 inline-block min-w-[1rem] h-8 text-black dark:text-white">
                            {guessed.has(char.toLowerCase()) || status !== 'playing' ? char : ''}
                        </span>
                    ))}
                </div>
                
                {status === 'playing' && (
                    <div className="text-zinc-500 mb-8 font-medium bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                        <Lightbulb size={16} className="text-yellow-500"/>
                        {word?.translation}
                    </div>
                )}

                {status !== 'playing' && (
                    <GameOverModal 
                        isWin={status === 'won'}
                        subTitle={status === 'won' ? `Tebrikler! Kelime: ${word?.term}` : `Maalesef bilemedin. Kelime: ${word?.term}`}
                        score={status === 'won' ? 50 : 0}
                        xp={status === 'won' ? 50 : -10}
                        onRestart={init}
                        onExit={() => setActiveGame('none')}
                    />
                )}
                
                {status === 'playing' && (
                    <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
                        {'abcdefghijklmnopqrstuvwxyz'.split('').map(char => (
                            <button
                                key={char}
                                onClick={() => guess(char)}
                                disabled={guessed.has(char)}
                                className={`w-9 h-10 rounded-lg font-bold text-lg transition-all ${
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
        const { snake, food, score, setDir, isGameOver, init, currentWord, lettersRevealed } = useSnake(words, (s, isWin) => {
            onAddXP(isWin ? Math.floor(s/2) : -5);
        });
        
        const handleTouch = (d: string) => {
            if (d === 'UP') setDir(prev => prev.y !== 1 ? {x: 0, y: -1} : prev);
            if (d === 'DOWN') setDir(prev => prev.y !== -1 ? {x: 0, y: 1} : prev);
            if (d === 'LEFT') setDir(prev => prev.x !== 1 ? {x: -1, y: 0} : prev);
            if (d === 'RIGHT') setDir(prev => prev.x !== -1 ? {x: 1, y: 0} : prev);
        };

        return (
            <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in overflow-hidden relative">
                <div className="flex items-center justify-between w-full max-w-xs mb-4">
                    <button onClick={() => setActiveGame('none')} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200"><ArrowLeft size={20} className="text-black dark:text-white"/></button>
                    <div className="font-bold text-xl text-black dark:text-white bg-white dark:bg-zinc-800 px-4 py-2 rounded-xl shadow-sm">
                        {score}
                    </div>
                    <div className="w-10"></div> 
                </div>

                <div className="mb-4 text-center h-8">
                    <div className="flex gap-1 justify-center">
                        {currentWord?.term.split('').map((char, i) => (
                            <span key={i} className={`w-6 h-8 flex items-center justify-center border-b-2 font-bold text-lg ${i < lettersRevealed ? 'border-black dark:border-white text-black dark:text-white animate-bounce' : 'border-zinc-300 dark:border-zinc-700 text-transparent'}`}>
                                {char}
                            </span>
                        ))}
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1 font-bold uppercase tracking-widest">{currentWord?.translation}</p>
                </div>

                <div className="relative bg-zinc-200 dark:bg-zinc-800 rounded-xl border-4 border-zinc-300 dark:border-zinc-700 w-[300px] h-[300px] shadow-inner">
                    {isGameOver && (
                        <GameOverModal 
                            isWin={score > 30}
                            title={score > 30 ? "Harika!" : "Oyun Bitti"}
                            score={score}
                            xp={score > 30 ? Math.floor(score/2) : -5}
                            onRestart={init}
                            onExit={() => setActiveGame('none')}
                        />
                    )}
                    {snake.map((seg, i) => (
                        <div 
                            key={i} 
                            className={`absolute w-[15px] h-[15px] rounded-sm z-10 ${i===0 ? 'bg-black dark:bg-white' : 'bg-zinc-600 dark:bg-zinc-400'}`}
                            style={{ left: seg.x * 15, top: seg.y * 15 }}
                        />
                    ))}
                    <div 
                        className="absolute w-[15px] h-[15px] bg-green-500 rounded-full animate-pulse z-0 flex items-center justify-center shadow-lg shadow-green-500/50"
                        style={{ left: food.x * 15, top: food.y * 15 }}
                    >
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-6">
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
        const { cards, handleCardClick, moves, isGameOver, init, timeElapsed, matches } = useMemory(words, (s, isWin) => {
            onAddXP(isWin ? s : -5);
        });

        return (
            <div className="flex flex-col items-center h-full p-4 animate-fade-in relative overflow-hidden">
                <div className="flex items-center justify-between w-full max-w-sm mb-6 shrink-0 bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 z-10">
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

                {isGameOver && (
                    <GameOverModal 
                        isWin={true}
                        title="Harika Hafıza!"
                        score={Math.max(10, 300 - (moves * 10) - (timeElapsed * 2))}
                        xp={Math.max(10, 300 - (moves * 10) - (timeElapsed * 2))}
                        onRestart={init}
                        onExit={() => setActiveGame('none')}
                    />
                )}
                
                <div className="grid grid-cols-3 gap-3 w-full max-w-sm flex-1 overflow-y-auto content-start py-4">
                    {cards.map((card, index) => (
                        <button
                            key={index}
                            onClick={() => handleCardClick(index)}
                            className={`aspect-[3/4] rounded-xl flex flex-col items-center justify-center p-2 text-center text-xs font-bold shadow-lg transition-all duration-500 transform perspective-1000 ${
                                card.isFlipped || card.isMatched 
                                    ? 'bg-white dark:bg-zinc-800 text-black dark:text-white rotate-y-0 border-b-4 border-zinc-200 dark:border-zinc-700' 
                                    : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-transparent rotate-y-180 border-b-4 border-indigo-700'
                            }`}
                            disabled={card.isMatched}
                            style={{ transformStyle: 'preserve-3d' }}
                        >
                            {(card.isFlipped || card.isMatched) ? (
                                <>
                                    <div className="mb-1 opacity-50 text-[10px]">{card.type === 'term' ? '🇬🇧' : '🇹🇷'}</div>
                                    <span className="animate-fade-in break-words w-full">{card.content}</span>
                                </>
                            ) : (
                                <Sparkles className="text-white/30" size={24} />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    // --- WORD SCRAMBLE RENDER ---
    const ScrambleGame = () => {
        const { currentWord, tiles, placedTiles, handleTileClick, score, feedback, nextWord, streak, timeLeft, isGameOver, init } = useScramble(words, (s, isWin) => {
            onAddXP(isWin ? s : -10);
        });

        return (
            <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in relative max-w-sm mx-auto overflow-hidden">
                 <button onClick={() => setActiveGame('none')} className="absolute top-4 left-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full z-10"><ArrowLeft size={20} className="text-black dark:text-white"/></button>
                 
                 <div className="flex justify-between items-center w-full mb-8 px-4">
                     <div className="text-center">
                         <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Süre</div>
                         <div className="text-2xl font-black text-blue-500 flex items-center justify-center gap-1"><Clock size={20} /> {timeLeft}s</div>
                     </div>
                     <div className="text-center">
                         <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Skor</div>
                         <div className="text-3xl font-black text-black dark:text-white">{score}</div>
                     </div>
                 </div>

                 {isGameOver && (
                     <GameOverModal 
                         isWin={score > 50}
                         title={score > 50 ? "Süre Doldu!" : "Yetersiz Puan"}
                         subTitle={`Süren bitti! Toplam skorun: ${score}`}
                         score={score}
                         xp={score > 50 ? Math.floor(score/2) : -10}
                         onRestart={init}
                         onExit={() => setActiveGame('none')}
                     />
                 )}

                 <div className="w-full text-center relative transition-all duration-300 flex-1">
                     {feedback === 'correct' && <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"><Check size={120} className="text-green-500 animate-bounce drop-shadow-lg" /></div>}
                     {feedback === 'wrong' && <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"><X size={120} className="text-red-500 animate-shake drop-shadow-lg" /></div>}
                     
                     <div className="mt-12">
                        <p className="text-lg font-bold text-zinc-600 dark:text-zinc-300 mb-8 bg-zinc-100 dark:bg-zinc-900 py-3 px-6 rounded-2xl inline-block shadow-sm">
                            "{currentWord?.translation}"
                        </p>
                        
                        <div className="flex justify-center gap-2 mb-8 h-14">
                            {placedTiles.map((tile) => (
                                <button 
                                    key={tile.id} 
                                    onClick={() => handleTileClick(tile)}
                                    className="w-10 h-12 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-xl shadow-lg animate-slide-up flex items-center justify-center border-b-4 border-zinc-700 dark:border-zinc-300 active:border-b-0 active:translate-y-1"
                                >
                                    {tile.char}
                                </button>
                            ))}
                            {Array.from({ length: Math.max(0, (currentWord?.term.length || 0) - placedTiles.length) }).map((_, i) => (
                                <div key={i} className="w-10 h-12 bg-zinc-200 dark:bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700"></div>
                            ))}
                        </div>
                        
                        <div className="flex flex-wrap justify-center gap-2 mb-8 min-h-[100px]">
                            {tiles.filter(t => t.status === 'pool').map((tile) => (
                                <button 
                                    key={tile.id} 
                                    onClick={() => handleTileClick(tile)}
                                    className="w-10 h-12 bg-white dark:bg-zinc-800 text-black dark:text-white rounded-xl font-bold text-xl shadow-md border-b-4 border-zinc-200 dark:border-zinc-700 active:border-b-0 active:translate-y-1 transition-all"
                                >
                                    {tile.char}
                                </button>
                            ))}
                        </div>
                     </div>
                 </div>
            </div>
        )
    }

    // --- SPEED QUIZ RENDER ---
    const SpeedQuizGame = () => {
        const { currentWord, options, score, timeLeft, isGameOver, handleAnswer, init, combo, lastResult } = useSpeedQuiz(words, (s, isWin) => {
            onAddXP(isWin ? s : -10);
        });

        return (
            <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in relative max-w-sm mx-auto overflow-hidden">
                <button onClick={() => setActiveGame('none')} className="absolute top-4 left-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full z-10"><ArrowLeft size={20} className="text-black dark:text-white"/></button>
                
                <div className="flex justify-between items-center w-full mb-8 px-2">
                    <div className="flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 px-4 py-2 rounded-full text-orange-600 dark:text-orange-400 font-bold shadow-sm">
                        <Clock size={16} /> {timeLeft}s
                    </div>
                    <div className="text-2xl font-black text-black dark:text-white">{score}</div>
                </div>

                {isGameOver && (
                    <GameOverModal 
                        isWin={score > 60}
                        title={score > 60 ? "Hız Rekoru!" : "Zamana Yenildin"}
                        score={score} 
                        xp={score > 60 ? score : -10} 
                        onRestart={init} 
                        onExit={() => setActiveGame('none')} 
                    />
                )}
                
                {!isGameOver && (
                    <div className="w-full">
                        <div className="text-center mb-8 relative">
                            {combo > 1 && (
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest animate-bounce shadow-lg">
                                    {combo}x Combo!
                                </div>
                            )}
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Bu kelimenin anlamı ne?</p>
                            <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-4">{currentWord?.term}</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                            {options.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => handleAnswer(opt.id)}
                                    className={`w-full py-4 border rounded-2xl text-lg font-bold shadow-sm hover:scale-[1.02] active:scale-95 transition-all relative overflow-hidden
                                        ${lastResult === 'correct' && opt.id === currentWord?.id ? 'bg-green-500 text-white border-green-600' : 
                                          lastResult === 'wrong' && opt.id === currentWord?.id ? 'bg-green-500 text-white border-green-600' :
                                          'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'}
                                    `}
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
        const { currentWord, options, score, lives, isGameOver, handleAnswer, playAudio, init } = useAudioQuiz(words, (s, isWin) => {
            onAddXP(isWin ? s : -10);
        });

        return (
            <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in relative max-w-sm mx-auto overflow-hidden">
                <button onClick={() => setActiveGame('none')} className="absolute top-4 left-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full z-10"><ArrowLeft size={20} className="text-black dark:text-white"/></button>
                
                <div className="flex justify-between items-center w-full mb-8 px-2">
                    <div className="flex gap-1">
                        {[...Array(3)].map((_, i) => (
                            <Heart key={i} size={24} className={`${i < lives ? 'fill-red-500 text-red-500' : 'fill-zinc-200 dark:fill-zinc-800 text-zinc-200 dark:text-zinc-800'}`} />
                        ))}
                    </div>
                    <div className="text-2xl font-black text-black dark:text-white">{score}</div>
                </div>

                {isGameOver && (
                    <GameOverModal 
                        isWin={score >= 40}
                        title={score >= 40 ? "Keskin Kulaklar!" : "Hatalı Duyum"}
                        score={score} 
                        xp={score >= 40 ? score : -10} 
                        onRestart={init} 
                        onExit={() => setActiveGame('none')} 
                    />
                )}
                
                {!isGameOver && (
                    <div className="w-full text-center">
                        <button 
                            onClick={() => currentWord && playAudio(currentWord.term)}
                            className="w-32 h-32 rounded-full bg-blue-500 text-white flex items-center justify-center mx-auto mb-10 shadow-xl shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all animate-pulse"
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
                        <h2 className="text-3xl font-black text-black dark:text-white">Arena Liderleri</h2>
                        <p className="text-zinc-500">En iyiler listesi</p>
                    </div>
                    <button onClick={() => setActiveTab('menu')} className="p-3 rounded-full bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white transition-colors hover:bg-zinc-200"><ArrowLeft /></button>
                </header>
                
                <div className="space-y-3">
                     {leaderboardData?.map((entry) => (
                         <div key={entry.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${entry.isCurrentUser ? 'bg-black text-white dark:bg-white dark:text-black border-transparent scale-[1.02] shadow-xl' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-black dark:text-white shadow-sm'}`}>
                             <div className="font-bold font-mono text-lg w-8 text-center">{entry.rank}</div>
                             <div className="text-2xl">{entry.avatar}</div>
                             <div className="flex-1 font-bold">{entry.name}</div>
                             <div className="font-mono opacity-60 text-sm">{entry.xp} XP</div>
                         </div>
                     ))}
                     {!leaderboardData?.length && (
                         <div className="text-center py-20">
                             <div className="animate-spin mb-4 flex justify-center"><RotateCcw size={32} className="text-zinc-300" /></div>
                             <p className="text-zinc-400 font-medium">Liderlik tablosu yükleniyor...</p>
                         </div>
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
                    <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-2">Arena</h2>
                    <p className="text-zinc-500 font-medium">Eğlenirken XP kazan veya kaybet.</p>
                </div>
                <button 
                    onClick={() => setActiveTab('leaderboard')}
                    className="flex flex-col items-center justify-center w-14 h-14 bg-yellow-400 text-yellow-900 rounded-2xl shadow-lg shadow-yellow-500/20 active:scale-95 transition-transform"
                >
                    <Trophy size={24} fill="currentColor" />
                </button>
            </header>

            <div className="grid grid-cols-1 gap-4 pb-6">
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
                        <h3 className="text-xl font-bold text-black dark:text-white mb-1">Adam Asmaca</h3>
                        <p className="text-zinc-500 text-xs font-medium">Bilemezsen XP kaybedersin!</p>
                    </div>
                </button>

                <button 
                    onClick={() => setActiveGame('scramble')}
                    className="relative overflow-hidden group bg-gradient-to-br from-orange-500 to-red-600 p-6 rounded-[2.5rem] text-left shadow-lg hover:shadow-orange-500/30 transition-all"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform duration-500">
                        <Shuffle size={120} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white mb-4 border border-white/30">
                            <Shuffle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">Kelime Karıştırma</h3>
                        <p className="text-orange-100 text-xs font-medium">60 saniyede kaç kelime?</p>
                    </div>
                </button>

                <button 
                    onClick={() => setActiveGame('snake')}
                    className="relative overflow-hidden group bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] text-left border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Grid size={120} className="text-black dark:text-white" />
                    </div>
                    <div className="relative z-10">
                         <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg">
                            <Grid size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-black dark:text-white mb-1">Yılan - Hecele</h3>
                        <p className="text-zinc-500 text-xs font-medium">Duvara çarparsan XP gider.</p>
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
                        <h3 className="text-xl font-bold text-white mb-1">Hafıza Kartları</h3>
                        <p className="text-blue-100 text-xs font-medium">En az hamlede bitir.</p>
                    </div>
                </button>

                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => setActiveGame('speed')}
                        className="relative overflow-hidden group bg-white dark:bg-zinc-900 p-5 rounded-[2rem] text-left border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-lg transition-all"
                    >
                        <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-yellow-900 mb-3 shadow-md">
                            <Zap size={20} />
                        </div>
                        <h3 className="text-sm font-bold text-black dark:text-white mb-1">Hızlı Cevap</h3>
                        <p className="text-zinc-500 text-[10px] font-medium">Zaman biterse -10 XP.</p>
                    </button>

                    <button 
                        onClick={() => setActiveGame('audio')}
                        className="relative overflow-hidden group bg-white dark:bg-zinc-900 p-5 rounded-[2rem] text-left border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-lg transition-all"
                    >
                        <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center text-white mb-3 shadow-md">
                            <Headphones size={20} />
                        </div>
                        <h3 className="text-sm font-bold text-black dark:text-white mb-1">Dinleme</h3>
                        <p className="text-zinc-500 text-[10px] font-medium">3 canın var.</p>
                    </button>
                </div>
            </div>
        </div>
    );
};
