import { describe, it, expect } from 'vitest';
import { WordData, UserWord, UserProfile } from '../types';

describe('Type Validation', () => {
    it('should validate WordData structure', () => {
        const word: WordData = {
            id: '1',
            term: 'hello',
            translation: 'merhaba',
            definition: 'A greeting',
            exampleSentence: 'Hello, world!',
            pronunciation: 'həˈloʊ',
            phoneticSpelling: 'huh-LOH',
            type: 'interjection',
        };

        expect(word.id).toBe('1');
        expect(word.term).toBe('hello');
        expect(word.translation).toBe('merhaba');
    });

    it('should validate UserWord extends WordData with SRS', () => {
        const userWord: UserWord = {
            id: '1',
            term: 'hello',
            translation: 'merhaba',
            definition: 'A greeting',
            exampleSentence: 'Hello, world!',
            pronunciation: 'həˈloʊ',
            phoneticSpelling: 'huh-LOH',
            type: 'interjection',
            dateAdded: Date.now(),
            srs: {
                nextReview: Date.now(),
                interval: 0,
                easeFactor: 2.5,
                streak: 0,
            },
        };

        expect(userWord.srs).toBeDefined();
        expect(userWord.srs.easeFactor).toBe(2.5);
        expect(userWord.dateAdded).toBeGreaterThan(0);
    });

    it('should validate UserProfile structure', () => {
        const profile: UserProfile = {
            email: 'test@example.com',
            username: 'TestUser',
            avatar: '🎓',
            level: 'B1',
            goal: 'IELTS',
            hasCompletedOnboarding: true,
            hasSeenTour: false,
            dailyTarget: 10,
            studyTime: '09:00',
            lastGeneratedDate: new Date().toDateString(),
            wordsStudiedToday: 5,
            lastStudyDate: new Date().toDateString(),
            xp: 100,
            streakFreeze: 0,
            streak: 3,
            longestStreak: 10,
            league: 'Bronze',
            theme: 'dark',
            settings: {
                autoPlayAudio: true,
                notifications: true,
                soundEffects: true,
            },
        };

        expect(profile.level).toBe('B1');
        expect(profile.goal).toBe('IELTS');
        expect(profile.settings.autoPlayAudio).toBe(true);
    });

    it('should validate all user levels are valid', () => {
        const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

        validLevels.forEach(level => {
            const profile: Partial<UserProfile> = {
                level: level as any,
            };

            expect(validLevels).toContain(profile.level);
        });
    });

    it('should validate all user goals are valid', () => {
        const validGoals = ['General English', 'IELTS', 'TOEFL', 'SAT', 'Business', 'Travel'];

        validGoals.forEach(goal => {
            const profile: Partial<UserProfile> = {
                goal: goal as any,
            };

            expect(validGoals).toContain(profile.goal);
        });
    });
});
