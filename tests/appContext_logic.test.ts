import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SRSGrade } from '../hooks/useSRS';
import { UserWord, Quest } from '../types';

// Mocking toast
vi.mock('../components/Toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('Quest & XP Logic', () => {
    const mockQuests: Quest[] = [
        { id: 'q1', title: 'Study 5 words', icon: 'book', type: 'study_words', target: 5, progress: 4, rewardXP: 100, completed: false },
        { id: 'q2', title: 'Play 3 games', icon: 'gamepad', type: 'play_games', target: 3, progress: 0, rewardXP: 50, completed: false },
    ];

    it('should calculate XP addition correctly', () => {
        let xp = 100;
        const addXP = (amount: number) => xp += amount;
        addXP(50);
        expect(xp).toBe(150);
    });

    it('should update quest progress and complete quest', () => {
        let quests = [...mockQuests];
        let xp = 0;
        const addXP = (amount: number) => xp += amount;

        const updateQuestProgress = (type: Quest['type'], amount: number) => {
            quests = quests.map(q => {
                if (q.type === type && !q.completed) {
                    const newProgress = Math.min(q.target, q.progress + amount);
                    const justCompleted = newProgress >= q.target;
                    if (justCompleted) {
                        addXP(q.rewardXP);
                    }
                    return { ...q, progress: newProgress, completed: justCompleted };
                }
                return q;
            });
        };

        // Complete Study 5 words (was at 4/5)
        updateQuestProgress('study_words', 1);

        expect(quests[0].progress).toBe(5);
        expect(quests[0].completed).toBe(true);
        expect(xp).toBe(100);
    });

    it('should not add XP if quest is already completed', () => {
        let quests = [{ ...mockQuests[0], completed: true, progress: 5 }];
        let xp = 0;
        const addXP = (amount: number) => xp += amount;

        const updateQuestProgress = (type: Quest['type'], amount: number) => {
            quests = quests.map(q => {
                if (q.type === type && !q.completed) {
                    const newProgress = Math.min(q.target, q.progress + amount);
                    const justCompleted = newProgress >= q.target;
                    if (justCompleted) addXP(q.rewardXP);
                    return { ...q, progress: newProgress, completed: justCompleted };
                }
                return q;
            });
        };

        updateQuestProgress('study_words', 1);
        expect(xp).toBe(0);
    });
});
