/**
 * Audio Manager - Singleton pattern for managing audio playback
 * Fixes Android audio issues by reusing AudioContext
 */

class AudioManager {
    private static instance: AudioManager;
    private audioContext: AudioContext | null = null;
    private currentSource: AudioBufferSourceNode | null = null;
    private audioCache: Map<string, string> = new Map(); // local in-memory cache
    private readonly CACHE_KEY_PREFIX = 'ml_audio_';

    private constructor() { }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    /**
     * Get or create AudioContext (singleton)
     */
    private getAudioContext(): AudioContext {
        if (!this.audioContext || this.audioContext.state === 'closed') {
            // @ts-ignore - WebKit prefix for older browsers
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass({ sampleRate: 24000 });
        }

        // Resume if suspended (important for mobile)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        return this.audioContext;
    }

    /**
     * Stop currently playing audio
     */
    public stop(): void {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
                this.currentSource.disconnect();
            } catch (e) {
                // Already stopped
            }
            this.currentSource = null;
        }
    }

    /**
     * Play PCM audio from base64
     */
    public async playPCMAudio(base64: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Stop any currently playing audio
                this.stop();

                const ctx = this.getAudioContext();
                const audioData = this.base64ToUint8Array(base64);
                const buffer = this.decodeAudioData(audioData, ctx, 24000, 1);

                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);

                source.onended = () => {
                    this.currentSource = null;
                    resolve();
                };

                this.currentSource = source;
                source.start(0);
            } catch (err) {
                console.error('Audio playback error:', err);
                reject(err);
            }
        });
    }

    /**
     * Play text using Web Speech API (fallback)
     */
    public async playTextToSpeech(text: string, lang: string = 'en-US'): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Cancel any ongoing speech
                window.speechSynthesis.cancel();

                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = lang;
                utterance.rate = 0.85;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;

                utterance.onend = () => resolve();
                utterance.onerror = (e) => reject(e);

                window.speechSynthesis.speak(utterance);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Convert base64 to Uint8Array
     */
    private base64ToUint8Array(base64: string): Uint8Array {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Decode PCM audio data to AudioBuffer
     */
    private decodeAudioData(
        data: Uint8Array,
        ctx: AudioContext,
        sampleRate: number,
        numChannels: number
    ): AudioBuffer {
        const dataInt16 = new Int16Array(data.buffer);
        const frameCount = dataInt16.length / numChannels;
        const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const channelData = buffer.getChannelData(channel);
            for (let i = 0; i < frameCount; i++) {
                channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
            }
        }

        return buffer;
    }

    /**
     * Centralized speak method with priority:
     * 1. Capacitor Native TTS (High Speed, Mobile)
     * 2. Gemini AI TTS (High Quality, Network)
     * 3. Web Speech API (Fast Fallback)
     */
    public async speak(text: string, options: {
        rate?: number,
        pitch?: number,
        useAIFirst?: boolean,
        timeout?: number
    } = {}): Promise<void> {
        const { rate = 1.0, pitch = 1.0, useAIFirst = false, timeout = 2500 } = options;

        // Check cache first
        const cacheKey = this.CACHE_KEY_PREFIX + btoa(text.slice(0, 50));
        const cachedAudio = this.audioCache.get(cacheKey) || localStorage.getItem(cacheKey);

        if (cachedAudio) {
            try {
                await this.playPCMAudio(cachedAudio);
                if (!this.audioCache.has(cacheKey)) this.audioCache.set(cacheKey, cachedAudio);
                return;
            } catch (e) {
                console.warn("Cached audio playback failed, generating new...");
            }
        }

        // Priority 1: Capacitor Native (if mobile and not AI-preferred)
        const isNative = (window as any).hasOwnProperty('Capacitor') || (window as any).Capacitor?.isNativePlatform?.();
        if (isNative && !useAIFirst) {
            try {
                const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
                await TextToSpeech.speak({
                    text,
                    lang: 'en-US',
                    rate,
                    pitch,
                    volume: 1.0,
                    category: 'ambient'
                });
                return;
            } catch (e) {
                console.warn("Native TTS failed, falling back to AI/Web...");
            }
        }

        // Priority 2: Gemini AI TTS
        if (useAIFirst || !isNative) {
            try {
                // We import geminiService dynamically to avoid circular dependencies
                const { generateAudio, playGeminiAudio } = await import('./geminiService');

                const audioPromise = generateAudio(text);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('AI TTS Timeout')), timeout)
                );

                const base64 = await Promise.race([audioPromise, timeoutPromise]) as string;

                // Save to cache
                try {
                    localStorage.setItem(cacheKey, base64);
                    this.audioCache.set(cacheKey, base64);
                } catch (e) {
                    // LocalStorage full?
                }

                await playGeminiAudio(base64);
                return;
            } catch (e) {
                console.warn("AI TTS failed or timed out, falling back to Web Speech:", e);
            }
        }

        // Priority 3: Web Speech API (Fallback)
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            return new Promise((resolve) => {
                try {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = 'en-US';
                    utterance.rate = rate;
                    utterance.pitch = pitch;

                    utterance.onend = () => resolve();
                    utterance.onerror = () => resolve(); // Don't block

                    window.speechSynthesis.speak(utterance);

                    // Safety timeout for Web Speech
                    setTimeout(resolve, 3000);
                } catch (err) {
                    resolve();
                }
            });
        }
    }

    /**
     * Cleanup resources
     */
    public dispose(): void {
        this.stop();
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

export const audioManager = AudioManager.getInstance();
