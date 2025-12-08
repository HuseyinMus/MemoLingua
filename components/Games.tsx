
import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Gamepad2, X, Ghost, BrainCircuit, Grid, ArrowLeft } from 'lucide-react';
import { LeaderboardEntry, UserProfile, UserWord } from '../types';

interface GamesProps {
    userProfile: UserProfile | null;
    words: UserWord[];
    onAddXP: (amount: number) => void;
    leaderboardData?: LeaderboardEntry[];
}

// --- GAME LOGIC HELPERS ---

// 1. HANGMAN LOGIC
const useHangman = (words: UserWord[], onEnd: (score: number) => void) => {
    const [word, setWord] = useState<UserWord | null>(null);
    const [guessed, setGuessed] = useState<Set<string>>(new Set());
    const [lives, setLives] = useState(6);
    const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');

    const init = useCallback(() => {
        if (words.length === 0) return;
        const random = words[Math.floor(Math.random() * words.length)];
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
                onEnd(0);
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
    
    const moveSnake = useCallback(() => {
        if (isPaused) return;
        
        setSnake(prev => {
            const head = { ...prev[0] };
            head.x += dir.x;
            head.y += dir.y;

            // Collision Wall
            if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
                setIsPaused(true);
                onEnd(score);
                return prev;
            }

            // Collision Self
            if (prev.some(s => s.x === head.x && s.y === head.y)) {
                setIsPaused(true);
                onEnd(score);
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
    }, [dir, food, isPaused, score, onEnd]);

    useEffect(() => {
        const interval = setInterval(moveSnake, 150);
        return () => clearInterval(interval);
    }, [moveSnake]);

    return { snake, food, score, setDir, isPaused, setIsPaused, dir };
};

export const Games: React.FC<GamesProps> = ({ userProfile, words, onAddXP, leaderboardData }) => {
    const [activeTab, setActiveTab] = useState<'menu' | 'leaderboard'>('menu');
    const [activeGame, setActiveGame] = useState<'none' | 'hangman' | 'snake'>('none');
    
    // --- HANGMAN RENDER ---
    const HangmanGame = () => {
        const gameWords = words.length > 0 ? words : [{term:'Welcome', translation:'Hoşgeldin'} as any];
        const { word, guessed, lives, status, guess, init } = useHangman(gameWords, (points) => onAddXP(points));
        
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in">
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
                        <span key={i} className="border-b-2 border-zinc-300 dark:border-zinc-700 mx-1">
                            {guessed.has(char.toLowerCase()) || status !== 'playing' ? char : '_'}
                        </span>
                    ))}
                </div>
                
                {status === 'playing' && (
                    <div className="text-zinc-500 mb-8 font-medium">İpucu: {word?.translation}</div>
                )}

                {status !== 'playing' ? (
                    <div className="text-center animate-slide-up">
                        <h3 className={`text-2xl font-bold mb-2 ${status === 'won' ? 'text-green-500' : 'text-red-500'}`}>
                            {status === 'won' ? 'Kazandın!' : 'Kaybettin'}
                        </h3>
                        <p className="mb-6 text-black dark:text-white">Kelime: <strong>{word?.term}</strong></p>
                        <div className="flex gap-4">
                            <button onClick={() => setActiveGame('none')} className="px-6 py-3 rounded-xl bg-zinc-200 dark:bg-zinc-800 font-bold text-black dark:text-white">Çıkış</button>
                            <button onClick={init} className="px-6 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold">Tekrar Oyna</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                        {'abcdefghijklmnopqrstuvwxyz'.split('').map(char => (
                            <button
                                key={char}
                                onClick={() => guess(char)}
                                disabled={guessed.has(char)}
                                className={`w-10 h-10 rounded-lg font-bold text-lg transition-all ${
                                    guessed.has(char) 
                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-600' 
                                        : 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm hover:scale-105 active:scale-95'
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
        const { snake, food, score, setDir, isPaused } = useSnake((s) => onAddXP(Math.floor(s/2)));
        
        const handleTouch = (d: string) => {
            if (d === 'UP') setDir(prev => prev.y !== 1 ? {x: 0, y: -1} : prev);
            if (d === 'DOWN') setDir(prev => prev.y !== -1 ? {x: 0, y: 1} : prev);
            if (d === 'LEFT') setDir(prev => prev.x !== 1 ? {x: -1, y: 0} : prev);
            if (d === 'RIGHT') setDir(prev => prev.x !== -1 ? {x: 1, y: 0} : prev);
        };

        return (
            <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in overflow-hidden">
                <div className="flex justify-between w-full max-w-xs mb-4">
                    <div className="font-bold text-xl text-black dark:text-white">Score: {score}</div>
                    <button onClick={() => setActiveGame('none')} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full"><X size={20}/></button>
                </div>

                <div className="relative bg-zinc-200 dark:bg-zinc-800 rounded-xl border-4 border-zinc-300 dark:border-zinc-700 w-[300px] h-[300px] shadow-inner">
                    {isPaused && (
                         <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center text-white font-bold text-2xl">
                             Game Over
                         </div>
                    )}
                    {snake.map((seg, i) => (
                        <div 
                            key={i} 
                            className="absolute w-[15px] h-[15px] bg-green-500 rounded-sm z-10"
                            style={{ left: seg.x * 15, top: seg.y * 15 }}
                        />
                    ))}
                    <div 
                        className="absolute w-[15px] h-[15px] bg-red-500 rounded-full animate-pulse z-0"
                        style={{ left: food.x * 15, top: food.y * 15 }}
                    />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-8">
                    <div></div>
                    <button onClick={() => handleTouch('UP')} className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center active:bg-zinc-300 text-black dark:text-white text-2xl font-bold">↑</button>
                    <div></div>
                    <button onClick={() => handleTouch('LEFT')} className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center active:bg-zinc-300 text-black dark:text-white text-2xl font-bold">←</button>
                    <button onClick={() => handleTouch('DOWN')} className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center active:bg-zinc-300 text-black dark:text-white text-2xl font-bold">↓</button>
                    <button onClick={() => handleTouch('RIGHT')} className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center active:bg-zinc-300 text-black dark:text-white text-2xl font-bold">→</button>
                </div>
            </div>
        );
    };

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

            <div className="grid grid-cols-1 gap-6">
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
                        <p className="text-green-100 text-sm font-medium">Klasik yılan oyunu ile reflekslerini test et.</p>
                    </div>
                </button>
            </div>
        </div>
    );
};
