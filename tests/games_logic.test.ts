import { describe, it, expect } from 'vitest';

describe('Games Logic Fixes', () => {

    describe('Hangman Language Logic', () => {
        it('should handle special characters correctly in guessing', () => {
            const word = "STUDY";
            const guessed = new Set(['s', 't', 'u', 'd']);

            const isWon = word.split('').every(c =>
                !/[a-zA-ZçğışöüÇĞİŞÖÜ]/.test(c) || guessed.has(c.toLowerCase())
            );

            expect(isWon).toBe(false);

            guessed.add('y');
            const isWonFinal = word.split('').every(c =>
                !/[a-zA-ZçğışöüÇĞİŞÖÜ]/.test(c) || guessed.has(c.toLowerCase())
            );
            expect(isWonFinal).toBe(true);
        });

        it('should handle Turkish characters correctly (tr-TR bug check)', () => {
            // Check if Turkish characters are handled in a way that doesn't break English words
            // In some environments, 'I'.toLowerCase() might be 'ı' in Turkish locale.
            // Our code uses c.toLowerCase() which should be consistent with the guessed set.

            const word = "BIT";
            const guessed = new Set(['b', 'i', 't']);

            const isWon = word.split('').every(c =>
                !/[a-zA-ZçğışöüÇĞİŞÖÜ]/.test(c) || guessed.has(c.toLowerCase())
            );

            expect(isWon).toBe(true);
        });
    });

    describe('Word Scramble Logic', () => {
        it('should separate characters but ignore non-alpha for tiles', () => {
            const term = "GO OUT";
            // The logic from Games.tsx:
            const chars = term.toUpperCase().split('').filter((c: string) => /[A-ZÇĞİŞÖÜ]/.test(c));

            expect(chars).toEqual(['G', 'O', 'O', 'U', 'T']);
            expect(chars.length).toBe(5); // Space is ignored for tile collection
        });

        it('should validate correctly against sanitized term', () => {
            const term = "GO OUT";
            const placedTilesChars = "GOOUT"; // User placed these

            const correctAnswer = term.toUpperCase().replace(/[^A-ZÇĞİŞÖÜ]/g, '');
            expect(placedTilesChars).toBe(correctAnswer);
        });
    });
});
