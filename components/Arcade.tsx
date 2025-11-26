import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Swords, Zap, Users, Timer, Star, Crown, Flame, ArrowRight, X, ArrowLeft, Check, Play, Shield, Heart, Skull, Target } from 'lucide-react';
import { LeaderboardEntry, GameEvent, GameMode, UserProfile, UserWord } from '../types';

interface ArcadeProps {
    userProfile: UserProfile | null;
    words: UserWord[];
    onAddXP: (amount: number) => void;
}

// Fallback words if user has none
const FALLBACK_WORDS = [
    { id: 'f1', term: 'Ephemeral', translation: 'Geçici', definition: 'Lasting for a very short time' },
    { id: 'f2', term: 'Serendipity', translation: 'Mutlu Tesadüf', definition: 'Finding something good without looking for it' },
    { id: 'f3', term: 'Resilient', translation: 'Dirençli', definition: 'Able to withstand or recover quickly' },
    { id: 'f4', term: 'Eloquent', translation: 'Düzgün Konuşan', definition: 'Fluent or persuasive in speaking or writing' },
    { id: 'f5', term: 'Mellifluous', translation: 'Kulağa Hoş Gelen', definition: 'Sweet or musical; pleasant to hear' },
    { id: 'f6', term: 'Ineffable', translation: 'Tarifsiz', definition: 'Too great or extreme to be expressed in words' },
    { id: 'f7', term: 'Solitude', translation: 'Yalnızlık', definition: 'The state or situation of being alone' },
];

export const Arcade: React.FC<ArcadeProps> = ({ userProfile, words, onAddXP }) => {
    const [tab, setTab] = useState<'games' | 'leaderboard'>('games');
    const [activeGame, setActiveGame] = useState<'none' | 'duel' | 'blitz'>('none');
    const [gameState, setGameState] = useState<'lobby' | 'playing' | 'result'>('lobby');
    
    // Game State
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [totalTime, setTotalTime] = useState(0); // For progress bar
    const [currentQuestion, setCurrentQuestion] = useState<any>(null);
    const [options, setOptions] = useState<any[]>([]);
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [mistakes, setMistakes] = useState<{term: string, correct: string, userChoice: string}[]>([]);
    
    // Blitz Specific: Combo System
    const [combo, setCombo] = useState(0);
    const [maxCombo, setMaxCombo] = useState(0);
    
    // Duel Specific: Health System
    const [playerHP, setPlayerHP] = useState(100);
    const [botHP, setBotHP] = useState(100);
    const [round, setRound] = useState(0);
    
    // Use ReturnType to avoid NodeJS namespace dependency in browser environment
    const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Prepare content pool
    const contentPool = words.length >= 4 ? words : FALLBACK_WORDS;

    // --- GAME LOGIC ---

    const startGame = (mode: 'duel' | 'blitz') => {
        setActiveGame(mode);
        setGameState('playing');
        setScore(0);
        setCombo(0);
        setMaxCombo(0);
        setMistakes([]);
        setFeedback(null);
        
        if (mode === 'blitz') {
            const time = 60;
            setTimeLeft(time);
            setTotalTime(time);
        } else {
            // Duel Setup
            const time = 10;
            setTimeLeft(time);
            setTotalTime(time);
            setPlayerHP(100);
            setBotHP(100);
            setRound(1);
        }
        
        nextQuestion();
    };

    const nextQuestion = () => {
        const randomWord = contentPool[Math.floor(Math.random() * contentPool.length)];
        setCurrentQuestion(randomWord);
        
        // Generate options (1 correct, 3 wrong)
        const wrongOptions = contentPool
            .filter(w => w.id !== randomWord.id)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);
        
        const allOptions = [randomWord, ...wrongOptions].sort(() => 0.5 - Math.random());
        setOptions(allOptions);
        setFeedback(null);

        // Duel Logic: Reset Bot Timer & Question Timer
        if (activeGame === 'duel') {
            setTimeLeft(10);
            if (botTimerRef.current) clearTimeout(botTimerRef.current);
            
            // Bot Attack Logic
            const botDelay = 3000 + Math.random() * 3000; // 3-6s delay
            botTimerRef.current = setTimeout(() => {
                // Bot attacks user if user hasn't answered yet
                setPlayerHP(prev => Math.max(0, prev - 20)); // Bot deals damage
                // Visual feedback for damage could go here
            }, botDelay);
        }
    };

    const handleAnswer = (selectedOption: any) => {
        if (feedback !== null) return; // Already answered

        const isCorrect = selectedOption.id === currentQuestion.id;
        
        if (isCorrect) {
            setFeedback('correct');
            
            // Blitz: Combo Calculation
            if (activeGame === 'blitz') {
                const newCombo = combo + 1;
                setCombo(newCombo);
                if (newCombo > maxCombo) setMaxCombo(newCombo);
                
                // Score Multiplier: 1x, 1.5x, 2x, etc.
                const multiplier = 1 + Math.floor(newCombo / 5) * 0.5;
                setScore(prev => prev + Math.floor(50 * multiplier));
            } 
            // Duel: Damage Bot
            else {
                const damage = 20 + Math.floor(timeLeft * 2); // Faster answer = more damage
                setBotHP(prev => Math.max(0, prev - damage));
                setScore(prev => prev + 100);
            }

        } else {
            setFeedback('wrong');
            setCombo(0); // Reset combo
            
            // Track mistake
            setMistakes(prev => [...prev, {
                term: currentQuestion.term,
                correct: currentQuestion.translation,
                userChoice: selectedOption.translation
            }]);

            // Duel: Take Damage
            if (activeGame === 'duel') {
                setPlayerHP(prev => Math.max(0, prev - 25));
            }
        }

        setTimeout(() => {
            // Check Win/Loss conditions
            if (activeGame === 'duel') {
                if (botHP <= 0 || playerHP <= 0) {
                    endGame();
                    return;
                }
                nextQuestion();
            } else {
                // Blitz continues until time runs out
                nextQuestion();
            }
        }, 1000);
    };

    const endGame = () => {
        setGameState('result');
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);
        if (botTimerRef.current) clearTimeout(botTimerRef.current);
        
        // Add XP
        // Bonus for Duel Win
        let finalXp = Math.floor(score / 10);
        if (activeGame === 'duel' && botHP <= 0) finalXp += 50; 
        
        onAddXP(finalXp);
    };

    const exitGame = () => {
        setActiveGame('none');
        setGameState('lobby');
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);
        if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };

    // Timer Logic
    useEffect(() => {
        if (gameState === 'playing') {
            gameTimerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 0.1) {
                        if (activeGame === 'blitz') {
                            endGame();
                            return 0;
                        } else if (activeGame === 'duel') {
                            // Time run out for duel question -> User takes damage
                            setPlayerHP(hp => {
                                const newHP = Math.max(0, hp - 20);
                                if (newHP === 0) { endGame(); return 0; }
                                return newHP;
                            });
                            nextQuestion();
                            return 10;
                        }
                    }
                    return prev - 0.1;
                });
            }, 100);
        }
        return () => {
            if (gameTimerRef.current) clearInterval(gameTimerRef.current);
            if (botTimerRef.current) clearTimeout(botTimerRef.current);
        };
    }, [gameState, activeGame]);


    // --- RENDERERS ---

    const renderGameResult = () => {
        const isWin = activeGame === 'duel' ? playerHP > 0 : true; // Blitz is always "finished", Duel is Win/Loss
        
        return (
            <div className="flex flex-col h-full p-6 animate-fade-in text-black dark:text-white max-w-md mx-auto overflow-y-auto pb-24">
                <div className="text-center mb-8 pt-8">
                    {isWin ? (
                        <div className="w-32 h-32 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center animate-bounce mx-auto mb-4 border-4 border-yellow-200 dark:border-yellow-700">
                            <Crown size={64} className="text-yellow-600 dark:text-yellow-400" />
                        </div>
                    ) : (
                        <div className="w-32 h-32 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-200 dark:border-red-800">
                            <Skull size={64} className="text-red-500" />
                        </div>
                    )}
                    
                    <h2 className="text-4xl font-black mb-1 tracking-tighter">{isWin ? 'VICTORY!' : 'DEFEATED'}</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium text-lg">
                        {activeGame === 'blitz' ? 'Time is up!' : playerHP > 0 ? 'You defeated the bot!' : 'Better luck next time.'}
                    </p>
                </div>

                {/* Score Card */}
                <div className="bg-zinc-50 dark:bg-zinc-900 rounded-[2rem] p-6 mb-6 border border-zinc-100 dark:border-zinc-800">
                     <div className="grid grid-cols-2 gap-4 text-center">
                         <div>
                             <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Score</p>
                             <p className="text-3xl font-black">{score}</p>
                         </div>
                         <div>
                             <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">XP Earned</p>
                             <p className="text-3xl font-black text-yellow-500">+{Math.floor(score / 10)}</p>
                         </div>
                     </div>
                     {activeGame === 'blitz' && (
                         <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center">
                             <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Max Combo</p>
                             <p className="text-xl font-bold flex items-center justify-center gap-1 text-orange-500">
                                 <Flame size={18} fill="currentColor" /> {maxCombo}x Streak
                             </p>
                         </div>
                     )}
                </div>

                {/* Mistakes Review */}
                {mistakes.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Mistakes to Review</h3>
                        <div className="space-y-3">
                            {mistakes.map((m, i) => (
                                <div key={i} className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-black dark:text-white">{m.term}</p>
                                        <div className="flex flex-col text-xs mt-1">
                                            <span className="text-red-500 line-through decoration-red-500/50">{m.userChoice}</span>
                                            <span className="text-green-600 dark:text-green-400 font-bold">{m.correct}</span>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-zinc-800 p-2 rounded-lg">
                                        <X size={16} className="text-red-500" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button onClick={exitGame} className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-transform mt-auto">
                    Return to Arena
                </button>
            </div>
        );
    };

    const renderGameInterface = () => {
        if (!currentQuestion) return null;
        
        const timerPercentage = (timeLeft / totalTime) * 100;
        const isLowTime = timerPercentage < 30;

        return (
            <div className="h-full flex flex-col p-6 animate-slide-up max-w-md mx-auto relative text-black dark:text-white overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-1 bg-zinc-100 dark:bg-zinc-800">
                    <div 
                        className={`h-full transition-all duration-100 linear ${isLowTime ? 'bg-red-500' : 'bg-blue-500'}`} 
                        style={{ width: `${timerPercentage}%` }}
                    />
                </div>

                {/* Header */}
                <div className="flex justify-between items-center mb-8 mt-4">
                     <button onClick={exitGame} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700">
                         <X size={20} />
                     </button>
                     
                     {/* Score / Combo Display */}
                     <div className="flex flex-col items-center">
                         <div className="text-3xl font-black font-mono tracking-tight">{score}</div>
                         {activeGame === 'blitz' && combo > 1 && (
                             <div className="flex items-center gap-1 text-orange-500 font-bold text-sm animate-bounce">
                                 <Flame size={14} fill="currentColor" /> {combo}x COMBO
                             </div>
                         )}
                     </div>

                     <div className="w-10 h-10"></div> {/* Spacer */}
                </div>

                {/* Duel HUD */}
                {activeGame === 'duel' && (
                    <div className="flex justify-between items-center mb-8 px-2">
                        {/* Player */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center border-2 border-blue-500 relative overflow-hidden">
                                {playerHP < 30 && <div className="absolute inset-0 bg-red-500/20 animate-pulse"></div>}
                                <span className="text-2xl">👤</span>
                            </div>
                            <div className="w-20 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${playerHP}%` }}></div>
                            </div>
                        </div>

                        <div className="font-black text-2xl italic text-zinc-300 dark:text-zinc-700">VS</div>

                        {/* Bot */}
                        <div className="flex flex-col items-center gap-2">
                             <div className={`w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center border-2 border-red-500 transition-transform ${feedback === 'correct' ? 'scale-90 bg-red-200' : ''}`}>
                                <span className="text-2xl">🤖</span>
                            </div>
                            <div className="w-20 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${botHP}%` }}></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Question Area */}
                <div className="flex-1 flex flex-col justify-center relative z-10">
                    <div className="text-center mb-8">
                        <div className="inline-block px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest mb-4">
                            Translate
                        </div>
                        <h2 className="text-4xl font-black mb-4 tracking-tight drop-shadow-sm">{currentQuestion.term}</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {options.map((opt, idx) => {
                            let stateStyle = 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-black dark:hover:border-white hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm';
                            
                            if (feedback === 'correct' && opt.id === currentQuestion.id) {
                                stateStyle = 'bg-green-500 border-green-600 text-white dark:border-green-400 shadow-green-200 dark:shadow-none scale-[1.02]';
                            } else if (feedback === 'wrong' && opt.id === currentQuestion.id) {
                                stateStyle = 'bg-green-500 border-green-600 text-white dark:border-green-400'; 
                            } else if (feedback === 'wrong' && opt === options.find(o => o.id !== currentQuestion.id && feedback)) {
                                stateStyle = 'bg-red-500 border-red-600 text-white dark:border-red-500 opacity-50';
                            }

                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer(opt)}
                                    disabled={feedback !== null}
                                    className={`p-5 rounded-2xl border-2 font-bold text-lg transition-all active:scale-95 flex items-center justify-between ${stateStyle}`}
                                >
                                    {opt.translation}
                                    {feedback === 'correct' && opt.id === currentQuestion.id && <Check size={20} />}
                                    {feedback === 'wrong' && opt.id !== currentQuestion.id && opt === options.find(o => o.id !== currentQuestion.id && feedback) && <X size={20} />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // --- MAIN RENDER ---
    
    if (gameState === 'playing') return renderGameInterface();
    if (gameState === 'result') return renderGameResult();

    // Mock Leaderboard Data
    const leaderboard: LeaderboardEntry[] = [
        { id: '1', name: 'Elara V.', xp: 15400, avatar: '👑', rank: 1 },
        { id: '2', name: 'Jaxon S.', xp: 14200, avatar: '🦁', rank: 2 },
        { id: '3', name: 'You', xp: userProfile?.xp || 0, avatar: '👤', rank: 3, isCurrentUser: true },
        { id: '4', name: 'Sarah K.', xp: 8900, avatar: '🦊', rank: 4 },
        { id: '5', name: 'Mike R.', xp: 7500, avatar: '🐼', rank: 5 },
    ].sort((a, b) => b.xp - a.xp);

    const events: GameEvent[] = [
        { id: 'e1', title: 'Weekend Rush', description: 'Double XP active', expiresIn: '2d 14h', type: 'boost', color: 'bg-indigo-600' },
        { id: 'e2', title: 'Vocab Marathon', description: 'Global Challenge', expiresIn: '12h', type: 'challenge', color: 'bg-orange-600' },
    ];

    const games: GameMode[] = [
        { id: 'duel', title: 'Word Duel', description: 'Defeat the bot to win XP', icon: Swords, players: '1.2k playing', status: 'active' },
        { id: 'blitz', title: 'Speed Blitz', description: '60s Combo Challenge', icon: Zap, players: '850 playing', status: 'active' },
    ];

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 pb-28">
            {/* Header */}
            <div className="px-6 pt-12 pb-6 bg-white dark:bg-zinc-900 rounded-b-[2.5rem] shadow-sm z-10 sticky top-0 transition-colors">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter">Arena</h2>
                        <p className="text-zinc-500 dark:text-zinc-400 font-medium">Compete & Win</p>
                    </div>
                    {/* League Badge */}
                    <div className="bg-gradient-to-r from-yellow-200 to-yellow-400 text-yellow-900 px-3 py-1.5 rounded-full text-xs font-bold border border-yellow-300 flex items-center gap-1.5 shadow-sm">
                        <Trophy size={14} fill="currentColor" />
                        Gold League
                    </div>
                </div>

                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl">
                    <button 
                        onClick={() => setTab('games')}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${tab === 'games' ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg scale-100' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                    >
                        Games
                    </button>
                    <button 
                        onClick={() => setTab('leaderboard')}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${tab === 'leaderboard' ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg scale-100' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                    >
                        Rankings
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
                {tab === 'games' ? (
                    <div className="space-y-8 animate-fade-in">
                        {/* Daily Challenge Card */}
                        <section className="bg-gradient-to-br from-black to-zinc-800 dark:from-zinc-800 dark:to-black rounded-[2.5rem] p-6 text-white relative overflow-hidden shadow-xl">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Target size={120} />
                            </div>
                            <div className="relative z-10">
                                <div className="inline-block px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg text-[10px] font-bold uppercase tracking-widest mb-3 border border-white/20">
                                    Daily Challenge
                                </div>
                                <h3 className="text-2xl font-bold mb-1">Perfect Streak</h3>
                                <p className="text-zinc-400 text-sm mb-6">Get 5 correct answers in a row in Blitz.</p>
                                <div className="h-2 w-full bg-white/10 rounded-full mb-4 overflow-hidden">
                                    <div className="h-full bg-green-500 w-2/5"></div>
                                </div>
                                <button className="w-full bg-white text-black py-3 rounded-xl text-xs font-bold shadow-lg hover:scale-[1.02] transition-transform">
                                    Claim 50 XP
                                </button>
                            </div>
                        </section>

                        {/* Events Section */}
                        <section>
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Flame size={14} className="text-orange-500 fill-orange-500" /> Live Events
                            </h3>
                            <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
                                {events.map(event => (
                                    <div key={event.id} className={`${event.color} min-w-[280px] p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer`}>
                                        <div className="absolute -top-4 -right-4 p-4 opacity-10 rotate-12 group-hover:rotate-45 transition-transform duration-700">
                                            <Star size={120} fill="white" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold inline-block mb-3 border border-white/10">
                                                Ends in {event.expiresIn}
                                            </div>
                                            <h4 className="text-2xl font-bold mb-1 tracking-tight">{event.title}</h4>
                                            <p className="text-white/80 text-sm font-medium mb-6">{event.description}</p>
                                            <div className="flex items-center gap-2 text-xs font-bold bg-black/20 w-fit px-3 py-2 rounded-xl backdrop-blur-sm">
                                                <Zap size={14} /> +XP Boost Active
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Games Grid */}
                        <section>
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Quick Play</h3>
                            <div className="grid grid-cols-1 gap-4">
                                {games.map(game => (
                                    <button 
                                        key={game.id} 
                                        onClick={() => startGame(game.id as any)}
                                        className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center gap-5 hover:border-black dark:hover:border-white hover:shadow-lg transition-all group active:scale-[0.98] text-left relative overflow-hidden"
                                    >
                                        <div className={`h-16 w-16 rounded-2xl flex items-center justify-center text-white shadow-md ${game.id === 'duel' ? 'bg-blue-600' : 'bg-rose-500'}`}>
                                            <game.icon size={28} />
                                        </div>
                                        <div className="flex-1 relative z-10">
                                            <h4 className="text-xl font-bold text-black dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{game.title}</h4>
                                            <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-2">{game.description}</p>
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 inline-block px-2 py-0.5 rounded-full border border-green-100 dark:border-green-900/50">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                {game.players}
                                            </div>
                                        </div>
                                        <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-full text-zinc-300 dark:text-zinc-600 group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-all">
                                            <Play size={20} fill="currentColor" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="animate-fade-in space-y-4">
                         {/* League Progress */}
                         <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm mb-6">
                             <div className="flex justify-between items-end mb-2">
                                 <h3 className="font-bold text-black dark:text-white">Promotion Zone</h3>
                                 <span className="text-xs font-bold text-green-500">Top 5 promote</span>
                             </div>
                             <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-green-500 w-3/5"></div>
                             </div>
                             <p className="text-xs text-zinc-400 mt-2 text-center">2 days left in season</p>
                         </div>

                        {/* Top 3 Podium */}
                        <div className="bg-zinc-900 dark:bg-black rounded-[2.5rem] p-8 text-white shadow-xl mb-6 relative overflow-hidden text-center border border-zinc-800">
                            <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12">
                                <Crown size={150} />
                            </div>
                            <div className="relative z-10">
                                <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-4">League Leader</p>
                                <div className="w-24 h-24 bg-gradient-to-tr from-yellow-300 to-yellow-500 rounded-full mx-auto mb-4 flex items-center justify-center text-5xl shadow-[0_0_30px_rgba(250,204,21,0.4)] border-4 border-zinc-800">
                                    {leaderboard[0].avatar}
                                </div>
                                <h3 className="text-3xl font-black mb-1">{leaderboard[0].name}</h3>
                                <p className="text-yellow-400 font-mono font-bold text-lg">{leaderboard[0].xp.toLocaleString()} XP</p>
                            </div>
                        </div>

                        {/* List */}
                        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                            {leaderboard.map((user, index) => (
                                <div 
                                    key={user.id} 
                                    className={`flex items-center gap-4 p-5 border-b border-zinc-50 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${user.isCurrentUser ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                >
                                    <div className={`w-8 font-bold text-center font-mono ${index < 3 ? 'text-black dark:text-white text-lg' : 'text-zinc-300 text-sm'}`}>#{user.rank}</div>
                                    <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                        {user.avatar}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-bold text-base ${user.isCurrentUser ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-900 dark:text-zinc-200'}`}>
                                            {user.name} {user.isCurrentUser && '(You)'}
                                        </p>
                                    </div>
                                    <div className="font-mono font-bold text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                                        {user.xp.toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};