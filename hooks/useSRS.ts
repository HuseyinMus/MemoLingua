import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserWord } from '../types';

export type SRSGrade = 'again' | 'hard' | 'good' | 'easy';

/**
 * Calculates the next review parameters based on the grade.
 */
export const calculateNextReview = (word: UserWord, grade: SRSGrade) => {
    const dayInMs = 24 * 60 * 60 * 1000;
    let newInterval = word.srs.interval;
    let newEase = word.srs.easeFactor;
    let nextReview = Date.now();
    let newStreak = word.srs.streak;

    if (grade === 'again') {
        newInterval = 0;
        nextReview = Date.now() + (10 * 60 * 1000); // 10 minutes
        newStreak = 0;
    } else if (grade === 'hard') {
        newInterval = Math.max(1, Math.round(newInterval * 1.2));
        nextReview = Date.now() + (newInterval * dayInMs);
        newEase = Math.max(1.3, newEase - 0.15);
        newStreak += 1;
    } else if (grade === 'good') {
        newInterval = Math.max(1, newInterval === 0 ? 1 : Math.round(newInterval * newEase));
        nextReview = Date.now() + (newInterval * dayInMs);
        newStreak += 1;
    } else if (grade === 'easy') {
        newInterval = Math.max(4, Math.round(newInterval * newEase * 1.3));
        nextReview = Date.now() + (newInterval * dayInMs);
        newEase = newEase + 0.15;
        newStreak += 1;
    }

    return {
        "srs.nextReview": nextReview,
        "srs.interval": newInterval,
        "srs.easeFactor": newEase,
        "srs.streak": newStreak
    };
};

/**
 * Updates the word in Firestore with new SRS data.
 */
export const updateWordSRS = async (userId: string, word: UserWord, grade: SRSGrade) => {
    const updates = calculateNextReview(word, grade);
    const wordDocRef = doc(db, "users", userId, "words", word.id);

    try {
        await updateDoc(wordDocRef, updates);
        return true;
    } catch (error) {
        console.error("SRS Update Failed:", error);
        throw error;
    }
};

export const useSRS = () => {
    return { updateWordSRS, calculateNextReview };
};
