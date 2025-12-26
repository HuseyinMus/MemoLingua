
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, UserWord, WordData, LeaderboardEntry, AppView, Quest, StudyMode } from '../types';
import { auth, db } from '../services/firebase';
import { doc, onSnapshot, setDoc, collection, query, orderBy, limit, QuerySnapshot, DocumentData, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from '../components/Toast';

interface AppContextType {
    userProfile: UserProfile | null;
    words: UserWord[];
    leaderboardData: LeaderboardEntry[];
    loading: boolean;
    view: AppView;
    setView: (view: AppView) => void;
    updateProfile: (key: keyof UserProfile, value: any) => void;
    addWords: (newWords: WordData[]) => Promise<void>;
    addXP: (amount: number) => void;
    updateQuestProgress: (type: Quest['type'], amount: number) => void;
    clearData: () => Promise<void>;
    dueWords: UserWord[];
    needsDailyBatch: boolean;
    currentStudyMode: StudyMode;
    setCurrentStudyMode: (mode: StudyMode) => void;
    handleSRSUpdate: (word: UserWord, grade: 'again' | 'hard' | 'good' | 'easy') => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [words, setWords] = useState<UserWord[]>([]);
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<AppView>(AppView.AUTH);
    const [currentStudyMode, setCurrentStudyMode] = useState<StudyMode>(StudyMode.MEANING);

    const dueWords = words.filter(w => w.srs.nextReview <= Date.now()).sort((a, b) => a.srs.nextReview - b.srs.nextReview);
    const needsDailyBatch = userProfile?.lastGeneratedDate !== new Date().toDateString();

    const handleSRSUpdate = async (word: UserWord, grade: 'again' | 'hard' | 'good' | 'easy') => {
        if (!auth.currentUser) return;
        const { updateWordSRS } = await import('../hooks/useSRS');
        await updateWordSRS(auth.currentUser.uid, word, grade);
        addXP(10);
        updateQuestProgress('study_words', 1);
    };

    // Profile & Words listener
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                // Profile Listener
                const unsubProfile = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
                    if (docSnap.exists()) {
                        setUserProfile({ uid: user.uid, ...docSnap.data() } as UserProfile);
                        if (!docSnap.data().hasCompletedOnboarding) setView(AppView.ONBOARDING);
                        else if (view === AppView.AUTH) setView(AppView.DASHBOARD);
                    } else {
                        setView(AppView.ONBOARDING);
                    }
                    setLoading(false);
                });

                // Words Listener
                const unsubWords = onSnapshot(collection(db, "users", user.uid, "words"), (snap) => {
                    const wordList = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserWord));
                    setWords(wordList);
                });

                return () => { unsubProfile(); unsubWords(); };
            } else {
                setUserProfile(null);
                setWords([]);
                setView(AppView.AUTH);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    // Leaderboard Listener
    useEffect(() => {
        const q = query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(20));
        const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
            const data = snap.docs.map((d, i) => ({
                id: d.id,
                name: String(d.data().name || 'Student'),
                xp: Number(d.data().xp || 0),
                avatar: String(d.data().avatar || '🎓'),
                rank: i + 1,
                isCurrentUser: auth.currentUser?.uid === d.id
            } as LeaderboardEntry));
            setLeaderboardData(data);
        });
        return () => unsub();
    }, []);

    const saveProfile = async (updated: UserProfile) => {
        if (!auth.currentUser) return;
        try {
            const { uid, ...cleaned } = updated;
            await setDoc(doc(db, "users", auth.currentUser.uid), cleaned, { merge: true });
            await setDoc(doc(db, "leaderboard", auth.currentUser.uid), {
                name: cleaned.username,
                avatar: cleaned.avatar,
                xp: cleaned.xp,
                lastActive: Date.now()
            }, { merge: true });
        } catch (err) {
            console.error(err);
        }
    };

    const updateProfile = (key: keyof UserProfile, value: any) => {
        if (userProfile) saveProfile({ ...userProfile, [key]: value });
    };

    const addXP = (amount: number) => {
        if (userProfile) updateProfile('xp', (userProfile.xp || 0) + amount);
    };

    const updateQuestProgress = (type: Quest['type'], amount: number) => {
        if (!userProfile || !userProfile.quests) return;
        let updated = false;
        const newQuests = userProfile.quests.map(q => {
            if (q.type === type && !q.completed) {
                const newProgress = Math.min(q.target, q.progress + amount);
                const justCompleted = newProgress >= q.target;
                if (justCompleted) {
                    addXP(q.rewardXP);
                    toast.success(`Görev Tamamlandı: ${q.title}`);
                }
                updated = true;
                return { ...q, progress: newProgress, completed: justCompleted };
            }
            return q;
        });
        if (updated) updateProfile('quests', newQuests);
    };

    const addWords = async (newWords: WordData[]) => {
        if (!auth.currentUser) return;
        const batch = writeBatch(db);
        newWords.forEach(w => {
            const ref = doc(collection(db, "users", auth.currentUser!.uid, "words"));
            batch.set(ref, {
                ...w,
                dateAdded: Date.now(),
                srs: { nextReview: Date.now(), interval: 0, easeFactor: 2.5, streak: 0 }
            });
        });
        await batch.commit();
        updateQuestProgress('add_words', newWords.length);
    };

    const clearData = async () => {
        if (!auth.currentUser) return;
        const batch = writeBatch(db);
        words.forEach(w => batch.delete(doc(db, "users", auth.currentUser!.uid, "words", w.id)));
        await batch.commit();
        window.location.reload();
    };

    return (
        <AppContext.Provider value={{
            userProfile, words, leaderboardData, loading, view, setView,
            updateProfile, addWords, addXP, updateQuestProgress, clearData,
            dueWords, needsDailyBatch, currentStudyMode, setCurrentStudyMode,
            handleSRSUpdate
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within AppProvider');
    return context;
};
