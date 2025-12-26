import { describe, it, expect, vi } from 'vitest';
import { useSRS } from '../hooks/useSRS';
import { UserWord } from '../types';

describe('useSRS Hook', () => {
    const mockWord: UserWord = {
        id: 'test-1',
        term: 'test',
        translation: 'test çevirisi',
        definition: 'A test word',
        exampleSentence: 'This is a test.',
        pronunciation: 'test',
        phoneticSpelling: '/test/',
        type: 'noun',
        dateAdded: Date.now(),
        srs: {
            nextReview: Date.now(),
            interval: 0,
            easeFactor: 2.5,
            streak: 0,
        },
    };

    it('should calculate correct interval for "again" grade', () => {
        const { calculateNextReview } = useSRS();
        const result = calculateNextReview(mockWord, 'again');

        expect(result['srs.interval']).toBe(0);
        expect(result['srs.streak']).toBe(0);
        expect(result['srs.nextReview']).toBeGreaterThan(Date.now());
    });

    it('should calculate correct interval for "good" grade', () => {
        const { calculateNextReview } = useSRS();
        const result = calculateNextReview(mockWord, 'good');

        expect(result['srs.interval']).toBeGreaterThanOrEqual(1);
        expect(result['srs.streak']).toBe(1);
    });

    it('should calculate correct interval for "easy" grade', () => {
        const { calculateNextReview } = useSRS();
        const result = calculateNextReview(mockWord, 'easy');

        expect(result['srs.interval']).toBeGreaterThanOrEqual(4);
        expect(result['srs.easeFactor']).toBeGreaterThan(2.5);
        expect(result['srs.streak']).toBe(1);
    });

    it('should increase interval progressively for consecutive "good" grades', () => {
        const { calculateNextReview } = useSRS();

        let currentWord = { ...mockWord };
        const result1 = calculateNextReview(currentWord, 'good');

        currentWord = {
            ...currentWord,
            srs: {
                ...currentWord.srs,
                interval: result1['srs.interval'],
                easeFactor: result1['srs.easeFactor'],
                streak: result1['srs.streak'],
            },
        };

        const result2 = calculateNextReview(currentWord, 'good');

        expect(result2['srs.interval']).toBeGreaterThan(result1['srs.interval']);
    });

    it('should reset interval to 0 for "again" grade', () => {
        const { calculateNextReview } = useSRS();

        const wordWithProgress = {
            ...mockWord,
            srs: {
                ...mockWord.srs,
                interval: 10,
                streak: 5,
            },
        };

        const result = calculateNextReview(wordWithProgress, 'again');

        expect(result['srs.interval']).toBe(0);
        expect(result['srs.streak']).toBe(0);
    });

    it('should decrease ease factor for "hard" grade but not below 1.3', () => {
        const { calculateNextReview } = useSRS();

        const wordWithLowEase = {
            ...mockWord,
            srs: {
                ...mockWord.srs,
                easeFactor: 1.4,
            },
        };

        const result = calculateNextReview(wordWithLowEase, 'hard');

        expect(result['srs.easeFactor']).toBeGreaterThanOrEqual(1.3);
    });
});
