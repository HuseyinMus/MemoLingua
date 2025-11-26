
import React, { useState } from 'react';
import { Target, GraduationCap, ArrowRight, Flame, Clock } from 'lucide-react';
import { UserLevel, UserGoal, UserProfile } from '../types';

interface OnboardingProps {
    onComplete: (profile: UserProfile) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState(0);
    const [tempLevel, setTempLevel] = useState<UserLevel>('A1');
    const [tempGoal, setTempGoal] = useState<UserGoal>('General English');
    const [tempDailyTarget, setTempDailyTarget] = useState<number>(10);
    const [tempStudyTime, setTempStudyTime] = useState<string>('09:00');

    const levels: UserLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const goals: UserGoal[] = ['General English', 'IELTS', 'TOEFL', 'SAT', 'Business', 'Travel'];
    const targets = [5, 10, 20, 30];
    
    const times = [
        { label: 'Sabah (09:00)', value: '09:00', icon: '☀️' },
        { label: 'Öğle (13:00)', value: '13:00', icon: '🌤️' },
        { label: 'Akşam (19:00)', value: '19:00', icon: '🌙' },
        { label: 'Gece (22:00)', value: '22:00', icon: '🦉' },
    ];

    const finishOnboarding = () => {
        onComplete({
            level: tempLevel,
            goal: tempGoal,
            hasCompletedOnboarding: true,
            hasSeenTour: false,
            dailyTarget: tempDailyTarget,
            studyTime: tempStudyTime,
            lastGeneratedDate: '', // Empty initially
            wordsStudiedToday: 0,
            lastStudyDate: new Date().toDateString(),
            xp: 0,
            streakFreeze: 0,
            theme: 'system',
            settings: { autoPlayAudio: true, notifications: true, soundEffects: true }
        });
    };

    return (
        <div className="h-full w-full bg-white dark:bg-zinc-950 flex flex-col p-8 animate-fade-in max-w-md mx-auto transition-colors duration-300">
            {step === 0 && (
                <div className="flex-1 flex flex-col justify-center">
                    <h1 className="text-4xl font-bold mb-4 tracking-tighter text-black dark:text-white">MemoLingua'ya Hoş Geldin.</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-lg mb-8">Bilimsel yöntemlerle İngilizce kelime hazineni geliştir.</p>
                    <button 
                        onClick={() => setStep(1)}
                        className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold flex items-center justify-center gap-2 group transition-transform active:scale-95"
                    >
                        Başlayalım <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                    </button>
                </div>
            )}

            {step === 1 && (
                <div className="flex-1 flex flex-col pt-12 animate-slide-up">
                    <div className="mb-8">
                        <Target className="w-10 h-10 mb-4 text-black dark:text-white" />
                        <h2 className="text-3xl font-bold mb-2 text-black dark:text-white">Hedefin ne?</h2>
                        <p className="text-zinc-500 dark:text-zinc-400">İçerikleri hedefine göre hazırlayacağız.</p>
                    </div>
                    <div className="space-y-3">
                        {goals.map(g => (
                            <button
                                key={g}
                                onClick={() => setTempGoal(g)}
                                className={`w-full p-4 rounded-xl text-left border transition-all ${tempGoal === g ? 'border-black dark:border-white bg-zinc-50 dark:bg-zinc-800 font-bold text-black dark:text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={() => setStep(2)}
                        className="mt-auto mb-4 bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold"
                    >
                        İleri
                    </button>
                </div>
            )}

            {step === 2 && (
                <div className="flex-1 flex flex-col pt-12 animate-slide-up">
                    <div className="mb-8">
                        <GraduationCap className="w-10 h-10 mb-4 text-black dark:text-white" />
                        <h2 className="text-3xl font-bold mb-2 text-black dark:text-white">Seviyen nedir?</h2>
                        <p className="text-zinc-500 dark:text-zinc-400">Tanımları ve örnekleri buna göre ayarlayacağız.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {levels.map(l => (
                            <button
                                key={l}
                                onClick={() => setTempLevel(l)}
                                className={`p-4 rounded-xl text-center border transition-all ${tempLevel === l ? 'border-black dark:border-white bg-zinc-50 dark:bg-zinc-800 font-bold text-black dark:text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={() => setStep(3)}
                        className="mt-auto mb-4 bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold"
                    >
                        İleri
                    </button>
                </div>
            )}

            {step === 3 && (
                <div className="flex-1 flex flex-col pt-12 animate-slide-up">
                    <div className="mb-8">
                        <Flame className="w-10 h-10 mb-4 text-black dark:text-white" />
                        <h2 className="text-3xl font-bold mb-2 text-black dark:text-white">Günlük Hedef</h2>
                        <p className="text-zinc-500 dark:text-zinc-400">Günde kaç yeni kelime?</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {targets.map(t => (
                            <button
                                key={t}
                                onClick={() => setTempDailyTarget(t)}
                                className={`p-6 rounded-xl text-center border transition-all flex flex-col items-center justify-center gap-1 ${tempDailyTarget === t ? 'border-black dark:border-white bg-zinc-50 dark:bg-zinc-800' : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
                            >
                                <span className={`text-3xl font-bold tracking-tighter ${tempDailyTarget === t ? 'text-black dark:text-white' : 'text-zinc-400 dark:text-zinc-600'}`}>{t}</span>
                                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Kelime</span>
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={() => setStep(4)}
                        className="mt-auto mb-4 bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold"
                    >
                        İleri
                    </button>
                </div>
            )}
            
            {step === 4 && (
                <div className="flex-1 flex flex-col pt-12 animate-slide-up">
                    <div className="mb-8">
                        <Clock className="w-10 h-10 mb-4 text-black dark:text-white" />
                        <h2 className="text-3xl font-bold mb-2 text-black dark:text-white">Çalışma Saati</h2>
                        <p className="text-zinc-500 dark:text-zinc-400">Yapay zeka sana her gün bu saatte yeni kelimeler hazırlayacak.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        {times.map(t => (
                            <button
                                key={t.value}
                                onClick={() => setTempStudyTime(t.value)}
                                className={`p-4 rounded-xl text-left border transition-all flex items-center gap-4 ${tempStudyTime === t.value ? 'border-black dark:border-white bg-zinc-50 dark:bg-zinc-800 font-bold text-black dark:text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
                            >
                                <span className="text-2xl">{t.icon}</span>
                                <span className="text-lg font-bold">{t.label}</span>
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={finishOnboarding}
                        className="mt-auto mb-4 bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold"
                    >
                        Öğrenmeye Başla
                    </button>
                </div>
            )}
        </div>
    );
};
