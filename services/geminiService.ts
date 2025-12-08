import { GoogleGenAI, Type, Modality } from "@google/genai";
import { WordData, UserLevel, UserGoal, GeneratedStory, ChatMessage } from "../types";

// Robustly get API Key from process.env or window polyfill
const getApiKey = (): string => {
    // Check standard process.env
    if (typeof process !== 'undefined' && process.env?.API_KEY) {
        return process.env.API_KEY;
    }
    // Check window.process polyfill (common in this app structure)
    if (typeof window !== 'undefined' && (window as any).process?.env?.API_KEY) {
        return (window as any).process.env.API_KEY;
    }
    console.warn("Gemini API Key is missing! AI features will not work.");
    return "";
};

// Lazy initialization to prevent app crash if key is missing on load
let aiInstance: GoogleGenAI | null = null;
const getAi = () => {
    if (!aiInstance) {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error("API Key is missing. Please check your configuration.");
        }
        aiInstance = new GoogleGenAI({ apiKey });
    }
    return aiInstance;
};

const modelId = "gemini-2.5-flash";
const ttsModelId = "gemini-2.5-flash-preview-tts";

export const generateSingleWord = async (term: string, level: UserLevel): Promise<WordData> => {
    const ai = getAi();
    const prompt = `Generate a detailed vocabulary card for the English word "${term}" suitable for a student at '${level}' level.
    
    Provide:
    - term: The English word (corrected if misspelled)
    - translation: Turkish translation
    - definition: A simple English definition
    - exampleSentence: An example sentence using the word
    - type: Part of speech (noun, verb, etc.)
    - pronunciation: IPA pronunciation
    - phoneticSpelling: A simple phonetic reading (e.g. "sked-yool")
    
    Return a strict JSON object.`;

    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    term: { type: Type.STRING },
                    translation: { type: Type.STRING },
                    definition: { type: Type.STRING },
                    exampleSentence: { type: Type.STRING },
                    pronunciation: { type: Type.STRING },
                    phoneticSpelling: { type: Type.STRING },
                    type: { type: Type.STRING },
                },
                required: ["term", "translation", "definition", "exampleSentence", "pronunciation", "phoneticSpelling", "type"],
            }
        }
    });

    const text = response.text;
    if (!text) throw new Error("No response");

    try {
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
        const data = JSON.parse(cleanText);
        return { ...data, id: crypto.randomUUID() };
    } catch (e) {
        console.error("JSON Parse Error", e);
        throw new Error("Failed to parse AI response");
    }
};

export const generateMnemonic = async (term: string, definition: string, translation: string): Promise<string> => {
    const ai = getAi();
    const prompt = `Create a short, memorable, and creative mnemonic aid (memory hook) for the English word "${term}" (Turkish: ${translation}).
    Definition: ${definition}.
    
    The mnemonic can be:
    1. A rhyme.
    2. A visual association.
    3. A funny connection between the English sound and Turkish meaning.
    
    Keep it under 25 words. Return ONLY the string.`;

    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
    });
    
    return response.text?.trim() || "No hint available.";
};

export const generateRoleplayResponse = async (
    scenarioTitle: string,
    history: ChatMessage[],
    userLevel: string
): Promise<{ text: string; correction?: string }> => {
    const ai = getAi();
    const chatHistory = history.map(h => `${h.sender === 'user' ? 'Student' : 'You'}: ${h.text}`).join('\n');
    const lastUserMessage = history[history.length - 1]?.text || "";

    const prompt = `You are a roleplay partner in a '${scenarioTitle}' scenario. The user is an English student (Level ${userLevel}).
    
    Chat History:
    ${chatHistory}
    
    Task:
    1. Respond naturally to the student's last message ("${lastUserMessage}") to keep the conversation going. Keep it concise (max 2 sentences).
    2. Analyze the student's last message for grammar or naturalness errors.
    
    Return JSON:
    {
      "response": "Your response here",
      "correction": "Optional correction if they made a mistake (e.g., 'Better way to say it: ...'). If perfect, return null."
    }`;

    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    response: { type: Type.STRING },
                    correction: { type: Type.STRING, nullable: true },
                },
                required: ["response"]
            }
        }
    });

    try {
        const cleanText = response.text?.replace(/```json/g, '').replace(/```/g, '');
        if (!cleanText) throw new Error("Empty response");
        const data = JSON.parse(cleanText);
        return { text: data.response, correction: data.correction };
    } catch (e) {
        console.error("Roleplay Error", e);
        return { text: "I didn't catch that. Could you say it again?" };
    }
};

export const generateDailyBatch = async (count: number, level: UserLevel, goal: UserGoal, existingWords: string[]): Promise<WordData[]> => {
    const ai = getAi();
    const prompt = `Generate exactly ${count} unique English vocabulary words for a student at '${level}' level who is interested in '${goal}'.
    
    Do NOT include these words: ${existingWords.slice(0, 50).join(', ')}.
    
    For each word, provide:
    - term: The English word
    - translation: Turkish translation
    - definition: A simple English definition suitable for ${level} level
    - exampleSentence: An example sentence related to '${goal}' context
    - type: Part of speech (noun, verb, adj...)
    - pronunciation: IPA pronunciation
    - phoneticSpelling: A simple phonetic reading for beginners (e.g. "sked-yool")
    
    Return a strict JSON array of objects.`;

    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        term: { type: Type.STRING },
                        translation: { type: Type.STRING },
                        definition: { type: Type.STRING },
                        exampleSentence: { type: Type.STRING },
                        pronunciation: { type: Type.STRING },
                        phoneticSpelling: { type: Type.STRING },
                        type: { type: Type.STRING },
                    },
                    required: ["term", "translation", "definition", "exampleSentence", "pronunciation", "phoneticSpelling", "type"],
                }
            }
        }
    });

    const text = response.text;
    if (!text) throw new Error("No response");

    try {
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
        const list = JSON.parse(cleanText);
        return list.map((item: any) => ({ ...item, id: crypto.randomUUID() }));
    } catch (e) {
        console.error("JSON Parse Error", e);
        throw new Error("Failed to parse AI response");
    }
};

// New Robust Story Generation
export const generateContextualStory = async (level: UserLevel, goal: UserGoal): Promise<Omit<GeneratedStory, 'id' | 'date'>> => {
    const ai = getAi();
    const prompt = `Write a short, engaging story (approx 150 words) suitable for an English learner at ${level} level. 
    The story theme should be related to: ${goal} (or general interesting fiction).
    
    Also, identify 5-7 key vocabulary words from the story and provide their details.
    
    Return JSON structure:
    {
      "title": "Story Title",
      "genre": "Genre Name (e.g. Sci-Fi, Travel)",
      "content": "Full story text...",
      "vocabulary": [
         { "term": "word", "translation": "turkish", "definition": "english def", "exampleSentence": "sentence from story", "type": "noun", "pronunciation": "IPA", "phoneticSpelling": "phonetic" }
      ]
    }`;

    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    genre: { type: Type.STRING },
                    content: { type: Type.STRING },
                    vocabulary: { 
                        type: Type.ARRAY,
                        items: {
                             type: Type.OBJECT,
                             properties: {
                                term: { type: Type.STRING },
                                translation: { type: Type.STRING },
                                definition: { type: Type.STRING },
                                exampleSentence: { type: Type.STRING },
                                pronunciation: { type: Type.STRING },
                                phoneticSpelling: { type: Type.STRING },
                                type: { type: Type.STRING },
                             }
                        }
                    }
                },
                required: ["title", "genre", "content", "vocabulary"]
            }
        }
    });
    
    const text = response.text;
    if (!text) throw new Error("Failed to generate story");
    
    try {
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
        const result = JSON.parse(cleanText);
        
        // Assign IDs to vocabulary
        const vocabulary = result.vocabulary.map((w: any) => ({ ...w, id: crypto.randomUUID() }));
        
        // Randomize cover gradient
        const gradients = [
            'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500',
            'bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500',
            'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500',
            'bg-gradient-to-br from-orange-400 via-red-500 to-pink-500',
            'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900',
        ];
        const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];

        return {
            title: result.title,
            content: result.content,
            genre: result.genre,
            level: level,
            coverGradient: randomGradient,
            vocabulary: vocabulary
        };
    } catch (e) {
        console.error("Story Parse Error", e);
        throw new Error("Failed to parse story response");
    }
};

export const generateAudio = async (text: string): Promise<string | undefined> => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: ttsModelId,
      contents: {
        parts: [{ text: text }]
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.warn("Audio generation failed:", error);
    return undefined;
  }
};

let audioContext: AudioContext | null = null;

export const playGeminiAudio = async (base64String: string): Promise<void> => {
    if (!base64String) throw new Error("No audio data provided");

    // Check environment support
    if (typeof window === 'undefined' || (!window.AudioContext && !(window as any).webkitAudioContext)) {
        throw new Error("Web Audio API not supported");
    }

    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const binaryString = atob(base64String);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        const dataInt16 = new Int16Array(bytes.buffer);
        const float32Data = new Float32Array(dataInt16.length);
        for (let i = 0; i < dataInt16.length; i++) {
            float32Data[i] = dataInt16[i] / 32768.0;
        }

        const buffer = audioContext.createBuffer(1, float32Data.length, 24000);
        buffer.copyToChannel(float32Data, 0);

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
        
        return new Promise((resolve) => {
            setTimeout(resolve, buffer.duration * 1000);
        });
    } catch (e) {
        console.error("Audio playback error:", e);
        throw new Error("Failed to play audio");
    }
};