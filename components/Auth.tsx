
import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, User as UserIcon } from 'lucide-react';
import { UserProfile } from '../types';

interface AuthProps {
    onLoginSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const auth = getAuth();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                onLoginSuccess();
            } else {
                if (!username.trim()) {
                    throw new Error("Lütfen bir kullanıcı adı girin.");
                }
                
                // 1. Create Auth User
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. Create Initial User Profile in Firestore
                const newProfile: UserProfile = {
                    uid: user.uid,
                    email: user.email || '',
                    username: username,
                    level: 'A1', // Default, will be updated in Onboarding
                    goal: 'General English',
                    hasCompletedOnboarding: false,
                    hasSeenTour: false,
                    dailyTarget: 10,
                    studyTime: '09:00',
                    lastGeneratedDate: '',
                    wordsStudiedToday: 0,
                    lastStudyDate: new Date().toDateString(),
                    xp: 0,
                    streakFreeze: 0,
                    theme: 'system',
                    settings: { autoPlayAudio: true, notifications: true, soundEffects: true }
                };

                await setDoc(doc(db, "users", user.uid), newProfile);
                
                onLoginSuccess();
            }
        } catch (err: any) {
            console.error("Auth Error", err);
            let msg = "Bir hata oluştu.";
            const errorCode = err.code;

            if (errorCode === 'auth/invalid-email') msg = "Geçersiz e-posta adresi.";
            else if (errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-credential') msg = "E-posta veya şifre hatalı.";
            else if (errorCode === 'auth/wrong-password') msg = "Şifre yanlış.";
            else if (errorCode === 'auth/email-already-in-use') msg = "Bu e-posta adresi zaten kayıtlı.";
            else if (errorCode === 'auth/weak-password') msg = "Şifre en az 6 karakter olmalı.";
            else if (errorCode === 'auth/too-many-requests') msg = "Çok fazla deneme yaptınız. Lütfen biraz bekleyin.";
            else if (err.message) msg = err.message;
            
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col justify-center p-8 max-w-md mx-auto animate-fade-in">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-black text-black dark:text-white mb-2 tracking-tighter">MemoLingua.</h1>
                <p className="text-zinc-500 dark:text-zinc-400">Bilim ve Yapay Zeka ile İngilizce Öğren.</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-xl border border-zinc-100 dark:border-zinc-800">
                <h2 className="text-2xl font-bold mb-6 text-black dark:text-white">
                    {isLogin ? 'Hoş Geldin' : 'Hesap Oluştur'}
                </h2>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-xl text-sm font-bold flex flex-col items-start gap-2">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                        {error.includes("zaten kayıtlı") && !isLogin && (
                            <button 
                                onClick={() => { setIsLogin(true); setError(null); }}
                                className="ml-6 text-xs underline hover:text-red-800 dark:hover:text-red-200"
                            >
                                Giriş Yapmaya Geç
                            </button>
                        )}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    {!isLogin && (
                        <div className="space-y-1 animate-slide-up">
                            <label className="text-xs font-bold text-zinc-400 uppercase ml-1">Kullanıcı Adı</label>
                            <div className="relative">
                                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                                <input 
                                    type="text" 
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-zinc-50 dark:bg-zinc-800 p-4 pl-12 rounded-xl outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-black dark:text-white font-medium"
                                    placeholder="Kullanıcı adınız"
                                    required={!isLogin}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-400 uppercase ml-1">E-Posta</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-800 p-4 pl-12 rounded-xl outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-black dark:text-white font-medium"
                                placeholder="ornek@email.com"
                                required
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-400 uppercase ml-1">Şifre</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-800 p-4 pl-12 rounded-xl outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-black dark:text-white font-medium"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 mt-4"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : (
                            <>
                                {isLogin ? 'Giriş Yap' : 'Kayıt Ol'} <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => { setIsLogin(!isLogin); setError(null); }}
                        className="text-sm font-medium text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                    >
                        {isLogin ? "Hesabın yok mu? Kayıt Ol" : "Zaten hesabın var mı? Giriş Yap"}
                    </button>
                </div>
            </div>
        </div>
    );
};
