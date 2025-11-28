
import React, { useState, useEffect } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, User as UserIcon, Check, X, ShieldCheck } from 'lucide-react';
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
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    
    // Email Verification State
    const [isVerificationSent, setIsVerificationSent] = useState(false);

    // Password Validation State
    const [pwdValidations, setPwdValidations] = useState({
        length: false,
        number: false,
        uppercase: false,
        special: false
    });

    const auth = getAuth();

    // Check Password Strength
    useEffect(() => {
        setPwdValidations({
            length: password.length >= 8,
            number: /\d/.test(password),
            uppercase: /[A-Z]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        });
    }, [password]);

    const isPasswordStrong = Object.values(pwdValidations).every(Boolean);

    const handleForgotPassword = async () => {
        if (!email) {
            setError("Şifre sıfırlama bağlantısı için lütfen e-posta adresinizi girin.");
            return;
        }
        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        try {
            await sendPasswordResetEmail(auth, email);
            setSuccessMsg("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
        } catch (err: any) {
            console.error("Reset Password Error", err);
            setError("Şifre sıfırlama e-postası gönderilemedi. E-posta adresini kontrol et.");
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);
        setLoading(true);

        try {
            if (isLogin) {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                
                // Optional: Check if email is verified before allowing login
                // if (!userCredential.user.emailVerified) {
                //     setError("Lütfen önce e-posta adresinizi doğrulayın.");
                //     await signOut(auth);
                //     setLoading(false);
                //     return;
                // }

                onLoginSuccess();
            } else {
                if (!username.trim()) throw new Error("Lütfen bir kullanıcı adı girin.");
                if (!isPasswordStrong) throw new Error("Şifreniz yeterince güçlü değil.");
                
                // 1. Create Auth User
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. Send Verification Email
                await sendEmailVerification(user);
                setIsVerificationSent(true);

                // 3. Create Initial User Profile in Firestore
                const newProfile: UserProfile = {
                    uid: user.uid,
                    email: user.email || '',
                    username: username,
                    avatar: '🎓',
                    level: 'A1',
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
                    streak: 0,
                    longestStreak: 0,
                    league: 'Bronze',
                    theme: 'system',
                    settings: { autoPlayAudio: true, notifications: true, soundEffects: true }
                };

                await setDoc(doc(db, "users", user.uid), newProfile);
                
                try {
                    await setDoc(doc(db, "leaderboard", user.uid), {
                        name: username,
                        xp: 0,
                        avatar: '🎓',
                        league: 'Bronze'
                    });
                } catch(err) { console.warn("Leaderboard init failed", err); }
                
                // Don't call onLoginSuccess yet, wait for user to acknowledge verification
            }
        } catch (err: any) {
            console.error("Auth Error", err);
            let msg = "Bir hata oluştu.";
            const errorCode = err.code;

            if (errorCode === 'auth/invalid-email') msg = "Geçersiz e-posta adresi.";
            else if (
                errorCode === 'auth/user-not-found' || 
                errorCode === 'auth/invalid-credential' || 
                errorCode === 'auth/invalid-login-credentials' || 
                errorCode === 'auth/wrong-password'
            ) {
                msg = "E-posta veya şifre hatalı.";
            }
            else if (errorCode === 'auth/email-already-in-use') msg = "Bu e-posta adresi zaten kayıtlı.";
            else if (errorCode === 'auth/weak-password') msg = "Şifre çok zayıf.";
            else if (err.message) msg = err.message;
            
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Verification Sent Screen
    if (isVerificationSent) {
        return (
             <div className="h-full flex flex-col justify-center p-8 max-w-md mx-auto animate-fade-in text-center">
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-xl border border-zinc-100 dark:border-zinc-800">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 dark:text-green-400">
                        <Mail size={40} />
                    </div>
                    <h2 className="text-2xl font-bold mb-4 text-black dark:text-white">E-Postanı Doğrula</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-8">
                        <strong>{email}</strong> adresine bir doğrulama bağlantısı gönderdik. Lütfen kutunu kontrol et ve hesabını aktifleştir.
                    </p>
                    <button 
                        onClick={() => {
                            setIsVerificationSent(false);
                            setIsLogin(true); // Switch back to login screen
                        }}
                        className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-transform"
                    >
                        Giriş Ekranına Dön
                    </button>
                </div>
             </div>
        );
    }

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
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-xl text-sm font-bold flex flex-col items-start gap-2 animate-slide-up">
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
                
                {successMsg && (
                    <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 rounded-xl text-sm font-bold flex items-center gap-2 animate-slide-up">
                        <Check size={16} />
                        <span>{successMsg}</span>
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
                        {/* Forgot Password Link */}
                        {isLogin && (
                            <div className="flex justify-end mt-2 px-1">
                                <button 
                                    type="button"
                                    onClick={handleForgotPassword}
                                    disabled={loading}
                                    className="text-xs font-bold text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                                >
                                    Şifremi Unuttum?
                                </button>
                            </div>
                        )}
                        {/* Password Strength Indicator (Only for Signup) */}
                        {!isLogin && password.length > 0 && (
                            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl mt-2 space-y-2 animate-slide-up">
                                <p className="text-xs font-bold text-zinc-500 uppercase">Şifre Gücü</p>
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                                    <div className={`flex items-center gap-1 ${pwdValidations.length ? 'text-green-500' : 'text-zinc-400'}`}>
                                        {pwdValidations.length ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-zinc-300"></div>}
                                        En az 8 karakter
                                    </div>
                                    <div className={`flex items-center gap-1 ${pwdValidations.uppercase ? 'text-green-500' : 'text-zinc-400'}`}>
                                        {pwdValidations.uppercase ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-zinc-300"></div>}
                                        1 Büyük Harf
                                    </div>
                                    <div className={`flex items-center gap-1 ${pwdValidations.number ? 'text-green-500' : 'text-zinc-400'}`}>
                                        {pwdValidations.number ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-zinc-300"></div>}
                                        1 Rakam
                                    </div>
                                    <div className={`flex items-center gap-1 ${pwdValidations.special ? 'text-green-500' : 'text-zinc-400'}`}>
                                        {pwdValidations.special ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-zinc-300"></div>}
                                        1 Özel Karakter
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading || (!isLogin && !isPasswordStrong)}
                        className={`w-full py-4 rounded-xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 mt-4 
                            ${(!isLogin && !isPasswordStrong) ? 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-black dark:bg-white text-white dark:text-black'}
                        `}
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
                        onClick={() => { setIsLogin(!isLogin); setError(null); setSuccessMsg(null); setPassword(''); }}
                        className="text-sm font-medium text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                    >
                        {isLogin ? "Hesabın yok mu? Kayıt Ol" : "Zaten hesabın var mı? Giriş Yap"}
                    </button>
                </div>
            </div>
        </div>
    );
};
