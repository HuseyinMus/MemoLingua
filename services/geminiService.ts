
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { WordData, UserLevel, UserGoal, GeneratedStory, ChatMessage, WritingFeedback } from "../types";

const modelId = "gemini-3-flash-preview";
const ttsModelId = "gemini-2.5-flash-preview-tts";

const VOCAB_SYSTEM_INSTRUCTION = "You are a specialized English language tutor. When generating vocabulary cards, ALWAYS provide the 'translation' field in Turkish. Definitions should be in clear, simple English. Example sentences should be natural and contextually rich.";

const getAi = () => {
    // Explicitly check for API key in both import.meta.env and process.env
    // This static access is required for bundlers to replace the variables correctly.
    const apiKey = 
      // @ts-ignore
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_KEY) || 
      // @ts-ignore
      (typeof process !== 'undefined' && process.env?.VITE_API_KEY) ||
      // @ts-ignore
      (typeof process !== 'undefined' && process.env?.API_KEY);

    // Hardcoded fallback for production/demo stability
    const finalKey = apiKey || "AIzaSyCpHO5HNsJb_Nq8pbhomSCFuIcCIxtfiP8";

    if (!finalKey) {
        console.error("Gemini API Key missing. Check .env for VITE_API_KEY");
    }
    return new GoogleGenAI({ apiKey: finalKey });
};

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
    id: String(w.id || crypto.randomUUID()),
    term: String(w.term || ''),
    translation: String(w.translation || ''),
    definition: String(w.definition || ''),
    exampleSentence: String(w.exampleSentence || ''),
    pronunciation: String(w.pronunciation || ''),
    phoneticSpelling: String(w.phoneticSpelling || ''),
    type: String(w.type || 'noun'),
});

export const generateContextualStory = async (level: UserLevel, topic: string): Promise<GeneratedStory> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Create an engaging short story about "${topic}" for an English learner at ${level} level. 
        Also extract 5 key vocabulary words from the story with Turkish translations.`,
        config: {
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
    
    // CRITICAL: response.text used as a primitive string to avoid circular structure errors
    const rawText = response.text || '{}';
    const parsed = JSON.parse(rawText);
    
    return {
        id: String(parsed.id || crypto.randomUUID()),
        title: String(parsed.title || ''),
        content: String(parsed.content || ''),
        genre: String(parsed.genre || ''),
        level: String(parsed.level || level),
        coverGradient: String(parsed.coverGradient || 'from-indigo-500 to-purple-500'),
        date: Date.now(),
        vocabulary: (parsed.vocabulary || []).map(sanitizeWord)
    };
};

export const generatePhrasalVerbBatch = async (
    count: number, 
    level: UserLevel, 
    baseVerb: string, 
    tone: string, 
    existingWords: string[], 
    topic: string
): Promise<WordData[]> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Generate ${count} phrasal verbs using the base verb "${baseVerb}". 
        Context/Topic: ${topic}. Tone: ${tone}. Level: ${level}. Avoid: ${existingWords.join(', ')}.`,
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

export const summarizeVoiceSession = async (transcript: any[], level: UserLevel): Promise<any> => {
    const ai = getAi();
    // Reduce objects to strings before sending to prevent serialization issues
    const conversationText = transcript
        .map(t => `${String(t.role === 'user' ? 'Student' : 'Tutor')}: ${String(t.text || '')}`)
        .join('\n');
    
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Analyze this English conversation. Student Level: ${level}. Transcript:\n${conversationText}`,
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

export const generateSingleWord = async (term: string, level: UserLevel): Promise<WordData> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Generate a detailed vocabulary card for: "${term}" (Level: ${level}). Translation must be in Turkish.`,
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

export const generateDailyBatch = async (count: number, level: UserLevel, goal: UserGoal, existingWords: string[]): Promise<WordData[]> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Generate ${count} unique English words for ${level} level and '${goal}' goal. Avoid: ${existingWords.slice(0, 20).join(',')}. Translation must be Turkish.`,
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

export const evaluateWriting = async (text: string, level: UserLevel): Promise<WritingFeedback> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Evaluate this text (Level: ${level}): "${text}"`,
        config: {
            systemInstruction: "You are an English writing evaluator. Feedback must be in Turkish.",
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
                    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
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

export const playGeminiAudio = async (base64: string): Promise<void> => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    try {
        const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
        source.onended = () => {
            if (ctx.state !== 'closed') ctx.close();
        };
    } catch (err) {
        if (ctx.state !== 'closed') ctx.close();
    }
};

export const generateAudio = async (text: string): Promise<string> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: ttsModelId,
        contents: [{ parts: [{ text: `Say clearly: ${text}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
    });
    const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64) throw new Error("Ses üretilemedi.");
    return String(base64);
};

export const getWordDeepDive = async (term: string, level: UserLevel): Promise<Partial<WordData>> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Provide a memory aid (mnemonic), a visual scene description, and the origin (etymology) for the word "${term}" at ${level} level. Turkish translations for the mnemonic and visual scene are required.`,
        config: {
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

export const extractVocabularyFromImage = async (base64: string, level: UserLevel): Promise<WordData[]> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64 } },
                { text: `Extract 5 useful English vocabulary words from this image for a ${level} level learner. Provide translations in Turkish and full details for each word.` }
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
                    required: ["term", "translation", "definition", "exampleSentence", "pronunciation", "phoneticSpelling", "type"]
                }
            }
        }
    });
    const parsed = JSON.parse(response.text || '[]');
    return Array.isArray(parsed) ? parsed.map(sanitizeWord) : [];
};

export const generateRoleplayResponse = async (message: string, scenario: string, level: UserLevel): Promise<string> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Scenario: ${scenario}. User Level: ${level}. Message: ${message}`,
        config: {
            systemInstruction: "You are an English conversation partner. Reply naturally and helpful."
        }
    });
    return String(response.text || "");
};

export const generateVisualMnemonic = async (term: string, translation: string): Promise<string> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Create a visual memory aid (in Turkish) for "${term}" (Turkish: ${translation}).`,
        config: { systemInstruction: "Provide short, vivid descriptions in Turkish." }
    });
    return String(response.text || "İpucu üretilemedi.").trim();
};

export const correctUserSentence = async (term: string, userSentence: string): Promise<{ isCorrect: boolean; feedback: string }> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: modelId,
        contents: `Term: "${term}", User Sentence: "${userSentence}". Feedback in Turkish.`,
        config: {
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
    return {
        isCorrect: Boolean(parsed.isCorrect),
        feedback: String(parsed.feedback || '')
    };
};
