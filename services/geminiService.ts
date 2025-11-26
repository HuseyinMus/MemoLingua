
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { WordData, UserLevel, UserGoal, GeneratedStory } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelId = "gemini-2.5-flash";
const ttsModelId = "gemini-2.5-flash-preview-tts";

export const generateSingleWord = async (term: string, level: UserLevel): Promise<WordData> => {
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

export const generateDailyBatch = async (count: number, level: UserLevel, goal: UserGoal, existingWords: string[]): Promise<WordData[]> => {
    
    // We provide a sample of existing words to avoid duplicates if possible, 
    // though with a large context window we can just ask it to be creative.
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
        // Clean markdown if present
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
        const list = JSON.parse(cleanText);
        return list.map((item: any) => ({ ...item, id: crypto.randomUUID() }));
    } catch (e) {
        console.error("JSON Parse Error", e);
        throw new Error("Failed to parse AI response");
    }
};

export const generateStoryFromWords = async (words: WordData[], level: UserLevel): Promise<Omit<GeneratedStory, 'id' | 'date'>> => {
    const terms = words.map(w => w.term).join(', ');
    
    const prompt = `Write a short, engaging story (approx 150 words) suitable for an English learner at ${level} level.
    You MUST use the following words in the story: ${terms}.
    Highlight the used words in the story by wrapping them in **double asterisks**.
    Provide a catchy title.`;

    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    content: { type: Type.STRING }
                },
                required: ["title", "content"]
            }
        }
    });
    
    const text = response.text;
    if (!text) throw new Error("Failed to generate story");
    
    try {
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
        const result = JSON.parse(cleanText);
        return {
            title: result.title,
            content: result.content,
            wordIds: words.map(w => w.id)
        };
    } catch (e) {
        console.error("Story Parse Error", e);
        throw new Error("Failed to parse story response");
    }
};

export const generateAudio = async (text: string): Promise<string | undefined> => {
  try {
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
