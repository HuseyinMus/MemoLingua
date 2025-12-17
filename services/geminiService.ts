
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { WordData, UserLevel, UserGoal, GeneratedStory, ChatMessage, WritingFeedback, VoiceSession } from "../types";

const modelId = "gemini-3-flash-preview";
const ttsModelId = "gemini-2.5-flash-preview-tts";

const getAi = () => {
    return new GoogleGenAI({ apiKey: String(process.env.API_KEY || '') });
};

const VOCAB_SYSTEM_INSTRUCTION = "You are a specialized English language tutor. When generating vocabulary cards, ALWAYS provide the 'translation' field in Turkish. Definitions should be in clear, simple English. Example sentences should be natural and contextually rich.";

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
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

const sanitizeWord = (w: any): WordData => ({
    id: w.id || crypto.randomUUID(),
    term: String(w.term || ''),
    translation: String(w.translation || ''),
    definition: String(w.definition || ''),
    exampleSentence: String(w.exampleSentence || ''),
    pronunciation: String(w.pronunciation || ''),
    phoneticSpelling: String(w.phoneticSpelling || ''),
    type: String(w.type || 'noun'),
});

export const summarizeVoiceSession = async (transcript: ChatMessage[], level: UserLevel): Promise<NonNullable<VoiceSession['analysis']>> => {
    const ai = getAi();
    const conversationText = transcript.map(t => `${t.role === 'user' ? 'Student' : 'Tutor'}: ${t.text}`).join('\n');
    
    const prompt = `Analyze this English conversation. Student Level: ${level}.
    Transcript:
    ${conversationText}
    
    Return JSON format in Turkish for grammarFeedback and suggestions. 
    - fluencyScore: 0 to 100
    - grammarFeedback: Key points to improve.
    - vocabularyUsed: Notable advanced words used.
    - suggestions: 3 specific tips.`;

    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    fluencyScore: { type: Type.NUMBER },
                    grammarFeedback: { type: Type.STRING },
                    vocabularyUsed: { type: Type.ARRAY, items: { type: Type.STRING } },
                    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["fluencyScore", "grammarFeedback", "vocabularyUsed", "suggestions"]
            }
        }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
        fluencyScore: Number(parsed.fluencyScore || 0),
        grammarFeedback: String(parsed.grammarFeedback || ''),
        vocabularyUsed: Array.isArray(parsed.vocabularyUsed) ? parsed.vocabularyUsed.map(String) : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : []
    };
};

export const evaluateWriting = async (text: string, level: UserLevel): Promise<WritingFeedback> => {
    const ai = getAi();
    const prompt = `Evaluate the following English text written by a ${level} level student. Analyze grammar, vocabulary, and flow. Text: "${text}" Return JSON format. Use Turkish for feedback and suggestions.`;

    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
            systemInstruction: "You are an English writing evaluator. Provide feedback in Turkish.",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.NUMBER },
                    cefrLevel: { type: Type.STRING },
                    feedback: { type: Type.STRING },
                    corrections: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                original: { type: Type.STRING },
                                corrected: { type: Type.STRING },
                                reason: { type: Type.STRING }
                            },
                            required: ["original", "corrected", "reason"]
                        }
                    },
                    suggestions: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ["score", "cefrLevel", "feedback", "corrections", "suggestions"]
            }
        }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
        score: Number(parsed.score || 0),
        cefrLevel: String(parsed.cefrLevel || ''),
        feedback: String(parsed.feedback || ''),
        corrections: Array.isArray(parsed.corrections) ? parsed.corrections.map((c: any) => ({
            original: String(c.original || ''),
            corrected: String(c.corrected || ''),
            reason: String(c.reason || '')
        })) : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : []
    };
};

export const getWordDeepDive = async (word: string, level: UserLevel): Promise<Partial<WordData>> => {
    const ai = getAi();
    const prompt = `Provide a deep dive into the English word "${word}". Include a memory hook (mnemonic) in Turkish, a visual scene description in Turkish, and its origin (etymology) in Turkish. Return JSON.`;

    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
            systemInstruction: "Provide deep dive information in Turkish.",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    mnemonic: { type: Type.STRING },
                    visualScene: { type: Type.STRING },
                    origin: { type: Type.STRING }
                },
                required: ["mnemonic", "visualScene", "origin"]
            }
        }
    });
    const parsed = JSON.parse(response.text || '{}');
    return {
        mnemonic: String(parsed.mnemonic || ''),
        visualScene: String(parsed.visualScene || ''),
        origin: String(parsed.origin || '')
    };
};

export const generateSingleWord = async (term: string, level: UserLevel): Promise<WordData> => {
    const ai = getAi();
    const prompt = `Generate a detailed vocabulary card for the English word "${term}" suitable for a student at '${level}' level. The 'translation' MUST be in Turkish. The 'definition' should be English.`;

    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
            systemInstruction: VOCAB_SYSTEM_INSTRUCTION,
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

    return sanitizeWord(JSON.parse(response.text || '{}'));
};

export const extractVocabularyFromImage = async (base64Image: string, level: UserLevel): Promise<WordData[]> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: { 
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: `Identify 5 English vocabulary words related to this image for a ${level} student. Ensure 'translation' is Turkish.` }
            ] 
        },
        config: {
            systemInstruction: VOCAB_SYSTEM_INSTRUCTION,
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

    const parsed = JSON.parse(response.text || '[]');
    return Array.isArray(parsed) ? parsed.map(sanitizeWord) : [];
};

export const generateVisualMnemonic = async (term: string, translation: string): Promise<string> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Create a short visual scene in Turkish to help remember "${term}" (Turkish: ${translation}).`,
        config: { systemInstruction: "You are a memory expert. Provide visual descriptions in Turkish." }
    });
    return String(response.text || "Görsel ipucu oluşturulamadı.").trim();
};

export const correctUserSentence = async (term: string, userSentence: string): Promise<{ isCorrect: boolean; feedback: string }> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Term: "${term}", Sentence: "${userSentence}". Check correctness. Feedback in Turkish.`,
        config: {
            systemInstruction: "Provide feedback in Turkish about the user's sentence.",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    isCorrect: { type: Type.BOOLEAN },
                    feedback: { type: Type.STRING }
                },
                required: ["isCorrect", "feedback"]
            }
        }
    });
    const parsed = JSON.parse(response.text || '{"isCorrect":false, "feedback":"Hata"}');
    return { isCorrect: !!parsed.isCorrect, feedback: String(parsed.feedback || '') };
};

export const generateDailyBatch = async (count: number, level: UserLevel, goal: UserGoal, existingWords: string[]): Promise<WordData[]> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Generate exactly ${count} unique English words for ${level} level and '${goal}' goal. Not in: ${existingWords.slice(0, 30).join(',')}. TRANSLATION MUST BE TURKISH.`,
        config: {
            systemInstruction: VOCAB_SYSTEM_INSTRUCTION,
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
    const parsed = JSON.parse(response.text || '[]');
    return Array.isArray(parsed) ? parsed.map(sanitizeWord) : [];
};

export const generateAudio = async (text: string): Promise<string> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: ttsModelId,
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
    });
    const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64) throw new Error("Audio generation failed");
    return String(base64);
};

export const playGeminiAudio = async (base64: string): Promise<void> => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioBuffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start();
};

export const generateContextualStory = async (level: UserLevel, topic: string): Promise<GeneratedStory> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Write a short story (approx 150 words) for a ${level} level student about "${topic}". Also extract 5 key vocabulary words from the story. Return JSON format.`,
        config: {
            systemInstruction: "You are a creative writer and language teacher. Provide content in English, but word translations in Turkish.",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    content: { type: Type.STRING },
                    genre: { type: Type.STRING },
                    level: { type: Type.STRING },
                    coverGradient: { type: Type.STRING },
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
                            },
                            required: ["term", "translation", "definition", "exampleSentence", "pronunciation", "phoneticSpelling", "type"]
                        }
                    }
                },
                required: ["title", "content", "genre", "level", "coverGradient", "vocabulary"]
            }
        }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
        id: crypto.randomUUID(),
        title: String(parsed.title || 'Untitled'),
        content: String(parsed.content || ''),
        genre: String(parsed.genre || 'General'),
        level: String(parsed.level || level),
        coverGradient: String(parsed.coverGradient || 'linear-gradient(to right, #6366f1, #a855f7)'),
        date: Date.now(),
        vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary.map(sanitizeWord) : []
    };
};

export const generatePhrasalVerbBatch = async (count: number, level: UserLevel, baseVerb: string, mode: 'formal' | 'informal', existingWords: string[], topic: string = 'general'): Promise<WordData[]> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Generate exactly ${count} ${mode} phrasal verbs using "${baseVerb}" for ${level} level about ${topic}. Not in: ${existingWords.slice(0, 30).join(',')}. TRANSLATION MUST BE TURKISH.`,
        config: {
            systemInstruction: VOCAB_SYSTEM_INSTRUCTION,
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
    const parsed = JSON.parse(response.text || '[]');
    return Array.isArray(parsed) ? parsed.map(sanitizeWord) : [];
};

export const generateRoleplayResponse = async (history: ChatMessage[], userMessage: string, level: UserLevel): Promise<string> => {
    const ai = getAi();
    const contents = history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(h.text || '') }]
    }));
    contents.push({ role: 'user', parts: [{ text: String(userMessage || '') }] });

    const response = await ai.models.generateContent({
        model: modelId,
        contents: contents as any,
        config: {
            systemInstruction: `You are an English tutor. The student's level is ${level}. Converse naturally and correct errors.`
        }
    });
    return String(response.text || "");
};
