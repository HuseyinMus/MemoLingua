
import React from 'react';
import { Settings as SettingsIcon, Trophy, Target, Star, Shield, Flame, BarChart3, LogOut, ArrowRight, CheckCircle2, Medal, Zap, Award, Crown, Calendar, Sparkles, ChevronRight, BookOpen, Gamepad2 } from 'lucide-react';
import { UserProfile, UserWord, Quest } from '../types';

interface ProfileProps {
    userProfile: UserProfile | null;
    words: UserWord[];
    onUpdateProfile: (key: keyof UserProfile, value: any) => void;
    onSignOut: () => void;
    onOpenSettings: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ userProfile, words, onUpdateProfile, onSignOut, onOpenSettings }) => {
    // Stats Calculations
    const totalWords = words.length;
    const masteredCount = words.filter(w => w.srs.interval >= 21).length;
    const learningCount = words.filter(w => w.srs.interval > 0 && w.srs.interval < 21).length;
    const newCount = words.filter(w => w.srs.interval === 0).length;
    
    const progressPercent = Math.min(100, ((userProfile?.xp || 0) % 1000) / 1000 * 100);
    const levelNumber = Math.floor((userProfile?.xp || 0) / 1000) + 1;

    // Örnek Görevler (Eğer profile'da yoksa gösterilir)
    const defaultQuests: Quest[] = [
        { id: 'q1', title: '10 Kelime Çalış', icon: 'BookOpen', target: 10, progress: userProfile?.wordsStudiedToday || 0, completed: (userProfile?.wordsStudiedToday || 0) >= 10, rewardXP: 20, type: 'study_words' },
        { id: 'q2', title: 'Arena\'da 1 Oyun Kazan', icon: 'Gamepad2', target: 1, progress: 0, completed: false, rewardXP: 15, type: 'play_games' },
        { id: 'q3', title: 'Yazma Atölyesi\'ni Kullan', icon: 'Zap', target: 1, progress: 0, completed: false, rewardXP: 25, type: 'writing_lab' },
    ];

    const quests = userProfile?.quests || defaultQuests;

    const getLeagueColor = (league: string) => {
        switch(league) {
            case 'Bronze': return 'from-orange-400 to-orange-700';
            case 'Silver': return 'from-zinc-300 to-zinc-500';
            case 'Gold': return 'from-yellow-400 to-yellow-600';
            case 'Platinum': return 'from-cyan-400 to-blue-500';
            case 'Diamond': return 'from-purple-500 to-indigo-600';
            default: return 'from-zinc-400 to-zinc-600';
        }
    };

    const getLeagueIcon = (league: string) => {
        switch(league) {
            case 'Diamond': return <Crown size={40} className="text-white drop-shadow-lg" />;
            case 'Gold': return <Medal size={40} className="text-white drop-shadow-lg" />;
            default: return <Shield size={40} className="text-white drop-shadow-lg" />;
        }
    };

    return (
        <div className="h-full w-full bg-zinc-50 dark:bg-zinc-950 flex flex-col p-6 pt-12 animate-fade-in overflow-y-auto scrollbar-hide pb-32 transition-colors">
            {/* Minimalist Header */}
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-black tracking-tighter text-black dark:text-white">Profilim</h2>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">İlerleyişini Takip Et</p>
                </div>
                <button 
                    onClick={onOpenSettings} 
                    className="p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 transition-all active:scale-95 text-zinc-500"
                >
                    <SettingsIcon size={20} />
                </button>
            </header>

            {/* Premium Identity Card */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 shadow-[0_10px_40px_rgba(0,0,0,0.03)] mb-8 flex flex-col items-center relative overflow-hidden group">
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                
                <div className="relative mb-6">
                    <div className="w-28 h-28 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center text-6xl shadow-inner border-4 border-white dark:border-zinc-950 relative z-10 overflow-hidden">
                        {userProfile?.avatar || '🎓'}
                    </div>
                    {/* Level Badge Overlay */}
                    <div className="absolute -bottom-1 -right-1 bg-black dark:bg-white text-white dark:text-black w-10 h-10 rounded-2xl flex items-center justify-center border-4 border-zinc-50 dark:border-zinc-900 shadow-xl font-black text-xs z-20">
                        {levelNumber}
                    </div>
                </div>

                <h3 className="text-2xl font-black mb-1 tracking-tight text-black dark:text-white uppercase">{userProfile?.username}</h3>
                <div className="flex gap-1.5 mb-8">
                    <div className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20">{userProfile?.level}</div>
                    <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-zinc-200 dark:border-zinc-800">{userProfile?.goal}</div>
                </div>

                {/* Modern XP Bar */}
                <div className="w-full space-y-2">
                    <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">XP İlerleyişi</span>
                        <span className="text-sm font-black text-black dark:text-white">{userProfile?.xp || 0} / {levelNumber * 1000}</span>
                    </div>
                    <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden p-1 shadow-inner">
                        <div 
                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl transition-all duration-1000 shadow-lg" 
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col">
                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-950/30 rounded-2xl flex items-center justify-center text-orange-500 mb-4 shadow-sm">
                        <Flame size={20} fill="currentColor" />
                    </div>
                    <p className="text-3xl font-black text-black dark:text-white leading-tight">{userProfile?.streak || 0}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Günlük Seri</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col">
                    <div className="w-10 h-10 bg-green-50 dark:bg-green-950/30 rounded-2xl flex items-center justify-center text-green-500 mb-4 shadow-sm">
                        <CheckCircle2 size={20} />
                    </div>
                    <p className="text-3xl font-black text-black dark:text-white leading-tight">{masteredCount}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Usta Kelime</p>
                </div>
            </div>

            {/* Quests Section */}
            <div className="mb-8">
                <div className="flex justify-between items-center px-2 mb-4">
                    <h4 className="font-black text-[10px] uppercase tracking-widest text-zinc-400">Günlük Görevler</h4>
                    <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Calendar size={10} /> Yenileniyor: 09:00
                    </span>
                </div>
                <div className="space-y-3">
                    {quests.map((quest) => (
                        <div key={quest.id} className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center gap-4 transition-all hover:border-indigo-500/30 group">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${quest.completed ? 'bg-green-500 text-white' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400'}`}>
                                {quest.type === 'study_words' && <BookOpen size={20} />}
                                {quest.type === 'play_games' && <Gamepad2 size={20} />}
                                {quest.type === 'writing_lab' && <Zap size={20} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <h5 className={`text-xs font-black truncate ${quest.completed ? 'text-zinc-400 line-through' : 'text-black dark:text-white'}`}>{quest.title}</h5>
                                    <span className="text-[9px] font-black text-green-500">+{quest.rewardXP} XP</span>
                                </div>
                                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${quest.completed ? 'bg-green-500' : 'bg-indigo-500'}`} 
                                        style={{ width: `${(quest.progress / quest.target) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                            {quest.completed && (
                                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full text-green-600">
                                    <CheckCircle2 size={16} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* League Section */}
            <div className={`p-8 rounded-[3.5rem] bg-gradient-to-br ${getLeagueColor(userProfile?.league || 'Bronze')} text-white shadow-2xl relative overflow-hidden mb-8 group active:scale-[0.98] transition-all`}>
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path d="M0,0 L100,0 L100,100 L0,100 Z" fill="url(#grid)" />
                        <defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/></pattern></defs>
                    </svg>
                </div>
                
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black opacity-70 uppercase tracking-widest">Global Sıralama</span>
                            <div className="bg-white/20 px-2 py-0.5 rounded-md text-[8px] font-black uppercase backdrop-blur-md">Sezon 12</div>
                        </div>
                        <h3 className="text-4xl font-black tracking-tighter mb-4">{userProfile?.league || 'Bronz'} Ligi</h3>
                        <p className="text-xs opacity-70 font-medium leading-relaxed max-w-[200px]">Liginde ilk 3'e girerek bir üst lige terfi etme şansı yakala!</p>
                    </div>
                    <div className="w-24 h-24 bg-white/20 backdrop-blur-xl rounded-[2.5rem] flex items-center justify-center border border-white/30 shadow-2xl transform rotate-12 group-hover:rotate-0 transition-transform duration-500">
                        {getLeagueIcon(userProfile?.league || 'Bronze')}
                    </div>
                </div>

                <div className="mt-8 flex items-center gap-4 bg-black/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                    <div className="flex-1">
                        <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-white w-2/3 shadow-[0_0_10px_white]"></div>
                        </div>
                        <p className="text-[9px] font-black uppercase mt-2 opacity-70">Terfi Bölgesindesin</p>
                    </div>
                    <ArrowRight size={20} className="opacity-50 group-hover:translate-x-1 transition-transform" />
                </div>
            </div>

            {/* Vocabulary Statistics - ENHANCED */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 shadow-sm mb-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h4 className="font-black text-sm text-black dark:text-white uppercase tracking-tighter">Kelime Dağarcığı</h4>
                        <p className="text-xs text-zinc-500 font-medium">Toplam İlerleme Durumu</p>
                    </div>
                    <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-xl">
                        <BarChart3 size={20} className="text-zinc-400" />
                    </div>
                </div>

                {/* Total Big Number */}
                <div className="mb-6">
                     <span className="text-5xl font-black text-black dark:text-white tracking-tighter">{totalWords}</span>
                     <span className="text-sm font-bold text-zinc-400 ml-2 uppercase tracking-widest">Kelime</span>
                </div>

                {/* Segmented Progress Bar */}
                <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex mb-6">
                    {/* Mastered */}
                    <div style={{ width: `${(masteredCount / Math.max(1, totalWords)) * 100}%` }} className="h-full bg-green-500 transition-all duration-1000" />
                    {/* Learning */}
                    <div style={{ width: `${(learningCount / Math.max(1, totalWords)) * 100}%` }} className="h-full bg-blue-500 transition-all duration-1000" />
                    {/* New (Implicitly remaining or specific color) */}
                    <div style={{ width: `${(newCount / Math.max(1, totalWords)) * 100}%` }} className="h-full bg-zinc-300 dark:bg-zinc-700 transition-all duration-1000" />
                </div>

                {/* Legend / Details */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Ustalaşılmış</span>
                        </div>
                        <span className="text-xs font-black text-black dark:text-white">{masteredCount} ({Math.round((masteredCount/Math.max(1,totalWords))*100)}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Öğreniliyor</span>
                        </div>
                        <span className="text-xs font-black text-black dark:text-white">{learningCount} ({Math.round((learningCount/Math.max(1,totalWords))*100)}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
                            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Yeni / Başlanmamış</span>
                        </div>
                        <span className="text-xs font-black text-black dark:text-white">{newCount} ({Math.round((newCount/Math.max(1,totalWords))*100)}%)</span>
                    </div>
                </div>
            </div>

            {/* Logout Footer */}
            <div className="pt-4 pb-12">
                <button 
                    onClick={onSignOut} 
                    className="w-full py-5 bg-red-50 dark:bg-red-900/10 text-red-500 font-black text-[10px] uppercase tracking-[0.2em] rounded-[2.5rem] border border-red-100 dark:border-red-900/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <LogOut size={16} /> Oturumu Kapat
                </button>
                <p className="text-center text-[9px] font-black text-zinc-300 dark:text-zinc-700 mt-6 uppercase tracking-widest">MemoLingua v1.2.5 • AI Engine</p>
            </div>
        </div>
    );
};
