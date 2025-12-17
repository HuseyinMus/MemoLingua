
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ArrowLeft, Mic, MicOff, Sparkles, Waves, Loader2, X, History, Trophy, Clock, GraduationCap, BookOpen, Fingerprint, Zap, ChevronRight, ShieldCheck, AlertCircle, Volume2 } from 'lucide-react';
import { UserProfile, UserWord, VoiceSession, ChatMessage, WordData } from '../types';
import { db } from '../services/firebase';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { summarizeVoiceSession, generateSingleWord } from '../services/geminiService';

interface VoiceTalkProps {
    userProfile: UserProfile | null;
    recentWords: UserWord[];
    onBack: () => void;
    onAddWords: (words: WordData[]) => void;
}

const EXAM_SCENARIOS = [
    { 
        id: 'mastery', 
        label: 'Vocab Mastery', 
        subLabel: 'Öğrendiğin kelimelerle pratik', 
        icon: Sparkles, 
        color: 'from-zinc-200 to-zinc-400',
        instruction: "Focus on testing the user's recently learned vocabulary. Be patient with their pronunciation. If they struggle, provide subtle hints."
    },
    { 
        id: 'ielts', 
        label: 'IELTS Speaking', 
        subLabel: 'Band 9 Interview', 
        icon: GraduationCap, 
        color: 'from-indigo-400 to-indigo-600',
        instruction: "Act as a formal IELTS examiner. Follow the interview structure. Focus on fluency, coherence, lexical resource, and grammatical range."
    },
    { 
        id: 'daily', 
        label: 'Daily Chat', 
        subLabel: 'Günlük Sohbet', 
        icon: Zap, 
        color: 'from-emerald-400 to-emerald-600',
        instruction: "Be a friendly language partner. Talk about daily topics like hobbies, weather, or work. Keep the flow natural and encouraging."
    },
    { 
        id: 'toefl', 
        label: 'TOEFL iBT', 
        subLabel: 'Academic Task', 
        icon: BookOpen, 
        color: 'from-amber-400 to-amber-600',
        instruction: "Act as a university professor discussing an academic topic. Ask the user to explain concepts or provide their opinion on scholarly matters."
    },
];

export const VoiceTalk: React.FC<VoiceTalkProps> = ({ userProfile, recentWords, onBack, onAddWords }) => {
    const [view, setView] = useState<'menu' | 'active' | 'report'>('menu');
    const [isActive, setIsActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    const [transcriptHistory, setTranscriptHistory] = useState<ChatMessage[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [currentOutput, setCurrentOutput] = useState('');
    const [selectedScenario, setSelectedScenario] = useState(EXAM_SCENARIOS[0]);
    const [isMuted, setIsMuted] = useState(false);
    const [inputVolume, setInputVolume] = useState(0); 
    
    const [currentReport, setCurrentReport] = useState<NonNullable<VoiceSession['analysis']>>({
        fluencyScore: 0, grammarFeedback: '', vocabularyUsed: [], suggestions: []
    });
    const [sessionDuration, setSessionDuration] = useState(0);
    const timerRef = useRef<any>(null);

    const sessionRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const isStoppingRef = useRef(false);

    function encode(bytes: Uint8Array) {
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    function decode(base64: string) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        return bytes;
    }

    async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
        const dataInt16 = new Int16Array(data.buffer);
        const frameCount = dataInt16.length / numChannels;
        const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
        for (let channel = 0; channel < numChannels; channel++) {
            const channelData = buffer.getChannelData(channel);
            for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
        return buffer;
    }

    const startSession = async () => {
        setIsConnecting(true);
        isStoppingRef.current = false;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = inputCtx;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            streamRef.current = stream;

            const systemInstruction = `
                Sen Zephyr adında profesyonel bir İngilizce dil koçusun. 
                MOD: ${selectedScenario.label}. 
                HEDEF: ${selectedScenario.instruction}.
                ÖĞRENCİ SEVİYESİ: ${userProfile?.level || 'A1'}.

                ÖNEMLİ KURALLAR:
                1. Kullanıcı konuşurken onu asla bölme. Cümlesinin bittiğinden emin olana kadar bekle.
                2. Kullanıcı duraksarsa teşvik edici "Go on", "Tell me more" gibi kısa ifadeler kullanabilirsin.
                3. Altyazılar (Transcription) için tane tane ve anlaşılır konuş.
                4. Eğer kullanıcıyı duyamazsan veya anlamazsan kibarca "I didn't quite catch that, could you repeat?" de.
                5. Sadece İngilizce konuş ve kullanıcının hatalarını sohbetin akışını bozmadan not et.
            `;

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        const source = inputCtx.createMediaStreamSource(stream);
                        const analyser = inputCtx.createAnalyser();
                        analyser.fftSize = 256;
                        source.connect(analyser);

                        const bufferLength = analyser.frequencyBinCount;
                        const dataArray = new Uint8Array(bufferLength);
                        const updateVolume = () => {
                            if (isStoppingRef.current) return;
                            analyser.getByteFrequencyData(dataArray);
                            let sum = 0;
                            for(let i=0; i<bufferLength; i++) sum += dataArray[i];
                            const average = sum / bufferLength;
                            setInputVolume(average);
                            requestAnimationFrame(updateVolume);
                        };
                        updateVolume();

                        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (e) => {
                            if (isMuted || isStoppingRef.current) return;
                            const inputData = e.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
                            const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionPromise.then(s => {
                                try { s.sendRealtimeInput({ media: pcmBlob }); } catch(err) {}
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputCtx.destination);
                        
                        setIsConnecting(false);
                        setIsActive(true);
                        setView('active');
                        timerRef.current = setInterval(() => setSessionDuration(d => d + 1), 1000);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        if (isStoppingRef.current) return;
                        if (msg.serverContent?.inputTranscription) {
                            setCurrentInput(msg.serverContent.inputTranscription.text);
                        }
                        if (msg.serverContent?.outputTranscription) {
                            setCurrentOutput(prev => prev + msg.serverContent!.outputTranscription!.text);
                        }
                        if (msg.serverContent?.turnComplete) {
                            setTranscriptHistory(prev => [
                                ...prev, 
                                { id: crypto.randomUUID(), role: 'user', text: currentInput, timestamp: Date.now() },
                                { id: crypto.randomUUID(), role: 'ai', text: currentOutput, timestamp: Date.now() }
                            ]);
                            setCurrentInput('');
                            setCurrentOutput('');
                        }

                        if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
                            const base64 = msg.serverContent.modelTurn.parts[0].inlineData.data;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            const buffer = await decodeAudioData(decode(base64), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = buffer;
                            source.connect(outputCtx.destination);
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += buffer.duration;
                        }
                    },
                    onerror: () => stopSession(),
                    onclose: () => stopSession(),
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: systemInstruction,
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (e) {
            console.error("Live session failed:", (e as any).message || e);
            setIsConnecting(false);
        }
    };

    const stopSession = async () => {
        if (isStoppingRef.current) return;
        isStoppingRef.current = true;
        
        clearInterval(timerRef.current);
        try { sessionRef.current?.close(); } catch(e) {}
        streamRef.current?.getTracks().forEach(t => t.stop());
        
        // Ensure AudioContext is not closed multiple times
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            try { await audioContextRef.current.close(); } catch(e) {}
        }
        
        setIsActive(false);
        
        if (transcriptHistory.length > 1) { 
            setIsAnalyzing(true);
            try {
                // Ensure we only pass string values to prevent circular structure errors
                const sanitizedHistory = transcriptHistory.map(t => ({
                    role: t.role,
                    text: String(t.text || '')
                }));
                const report = await summarizeVoiceSession(sanitizedHistory, userProfile?.level || 'A1');
                setCurrentReport(report);
                setView('report');
            } catch (e) {
                setView('menu');
            } finally {
                setIsAnalyzing(false);
            }
        } else {
            setView('menu');
        }
    };

    const handleAddReportWords = async () => {
        setIsAnalyzing(true);
        try {
            const wordPromises = currentReport.vocabularyUsed.slice(0, 5).map(term => 
                generateSingleWord(term, userProfile?.level || 'A1')
            );
            const words = await Promise.all(wordPromises);
            onAddWords(words);
        } catch (e) {
            console.error("Kelimeler eklenemedi", (e as any).message || e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="h-full w-full bg-[#050505] text-white flex flex-col font-sans relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-indigo-600/10 blur-[120px] pointer-events-none"></div>

            <header className="flex items-center justify-between p-6 z-50">
                <button onClick={isActive ? stopSession : onBack} className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl active:scale-95 transition-all">
                    <ArrowLeft size={20} />
                </button>
                <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Live AI Coach</p>
                    <p className="text-xs font-mono text-indigo-400">{isActive ? `${Math.floor(sessionDuration / 60)}:${(sessionDuration % 60).toString().padStart(2, '0')}` : 'READY'}</p>
                </div>
                <div className="w-10"></div>
            </header>

            <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
                {view === 'menu' && (
                    <div className="w-full max-w-sm space-y-4 animate-fade-in">
                        <div className="text-center mb-8">
                            <h3 className="text-4xl font-black mb-2 tracking-tighter">Akademik Diyalog</h3>
                            <p className="text-zinc-400 text-sm">Yapay zeka ile gerçek zamanlı konuşma pratiği yap.</p>
                        </div>
                        <div className="space-y-2 mb-6">
                            {EXAM_SCENARIOS.map(s => (
                                <button key={s.id} onClick={() => setSelectedScenario(s)} className={`w-full p-5 rounded-[2rem] border flex items-center gap-4 transition-all duration-300 ${selectedScenario.id === s.id ? 'bg-zinc-900 border-indigo-500/50 shadow-lg shadow-indigo-500/5' : 'bg-transparent border-transparent opacity-40 hover:opacity-100'}`}>
                                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center text-black shadow-lg`}><s.icon size={24}/></div>
                                    <div className="text-left">
                                        <p className="font-black text-sm">{s.label}</p>
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{s.subLabel}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <button onClick={startSession} disabled={isConnecting} className="w-full py-5 bg-white text-black font-black rounded-[2.5rem] shadow-2xl shadow-white/10 flex items-center justify-center gap-3 active:scale-95 transition-all">
                            {isConnecting ? <Loader2 className="animate-spin" /> : <Zap size={20} fill="currentColor"/>}
                            {isConnecting ? 'KOÇ BAĞLANILIYOR...' : 'SOHBETİ BAŞLAT'}
                        </button>
                    </div>
                )}

                {view === 'active' && (
                    <div className="flex flex-col items-center gap-10 animate-fade-in w-full max-w-sm">
                        <div className="relative group">
                            <div className={`absolute inset-0 bg-indigo-500/20 blur-[60px] rounded-full transition-all duration-500 ${inputVolume > 10 ? 'scale-150 opacity-100' : 'scale-100 opacity-0'}`}></div>
                            <div className={`w-56 h-56 rounded-full bg-white flex items-center justify-center transition-all duration-300 relative z-10 ${currentOutput ? 'scale-110 shadow-[0_0_80px_rgba(255,255,255,0.3)]' : 'scale-100 opacity-40'}`}>
                                <Waves size={80} className={`text-black transition-transform duration-100 ${currentOutput ? 'animate-pulse' : ''}`} style={{ transform: `scale(${1 + (inputVolume / 100)})` }} />
                            </div>
                            
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                                <div 
                                    className="h-full bg-indigo-500 transition-all duration-75" 
                                    style={{ width: `${Math.min(100, inputVolume * 2)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="w-full space-y-4">
                            <div className={`text-center p-6 rounded-[2.5rem] border transition-all duration-500 min-h-[140px] flex items-center justify-center ${currentOutput ? 'bg-white/5 border-white/10' : 'bg-transparent border-transparent opacity-0'}`}>
                                <p className="text-xl font-bold leading-tight text-white/90 italic">
                                    {currentOutput}
                                </p>
                            </div>

                            <div className={`text-center transition-all duration-300 ${currentInput ? 'opacity-100' : 'opacity-0'}`}>
                                <span className="px-4 py-2 bg-indigo-500 text-white rounded-full text-sm font-black shadow-lg shadow-indigo-500/20">
                                    {currentInput || 'Dinleniyor...'}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-4 z-50">
                            <button onClick={() => setIsMuted(!isMuted)} className={`p-6 rounded-full border transition-all active:scale-90 ${isMuted ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-zinc-900 border-zinc-800'}`}>
                                {isMuted ? <MicOff /> : <Mic />}
                            </button>
                            <button onClick={stopSession} className="px-12 py-5 bg-red-600 text-white font-black rounded-full shadow-2xl shadow-red-600/20 active:scale-95 transition-all flex items-center gap-2">
                                <X size={20} /> SEANSI BİTİR
                            </button>
                        </div>
                    </div>
                )}

                {view === 'report' && (
                    <div className="w-full max-w-sm space-y-6 animate-slide-up overflow-y-auto scrollbar-hide pb-10">
                        <div className="bg-zinc-900 p-8 rounded-[3rem] text-center border border-zinc-800 shadow-2xl">
                            <p className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">Fluency Score</p>
                            <h3 className="text-6xl font-black">%{currentReport.fluencyScore}</h3>
                            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full text-xs font-bold text-zinc-400">
                                <Clock size={14}/> {Math.floor(sessionDuration / 60)}dk {(sessionDuration % 60)}sn
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800">
                                <h4 className="font-black text-xs uppercase text-zinc-500 mb-2 flex items-center gap-2"><ShieldCheck size={14} className="text-green-500" /> Gramer ve Telaffuz</h4>
                                <p className="text-sm leading-relaxed">{currentReport.grammarFeedback}</p>
                            </div>

                            <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800">
                                <h4 className="font-black text-xs uppercase text-zinc-500 mb-3 flex items-center gap-2"><Zap size={14} className="text-yellow-500" /> Öğrenilen Yeni Kelimeler</h4>
                                <div className="flex flex-wrap gap-2">
                                    {currentReport.vocabularyUsed.map((v, i) => (
                                        <span key={i} className="px-3 py-1 bg-white/10 rounded-lg text-xs font-bold">{v}</span>
                                    ))}
                                </div>
                                <button 
                                    onClick={handleAddReportWords}
                                    className="w-full mt-4 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-indigo-600/20"
                                >
                                    <Sparkles size={14} /> Kelimeleri Koleksiyona Ekle
                                </button>
                            </div>
                        </div>
                        <button onClick={() => setView('menu')} className="w-full py-5 bg-white text-black font-black rounded-[2rem] active:scale-95 transition-all">ANA MENÜYE DÖN</button>
                    </div>
                )}
            </div>

            {isAnalyzing && (
                <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-10 text-center animate-fade-in">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse"></div>
                        <Loader2 size={64} className="animate-spin text-white relative z-10" />
                    </div>
                    <h3 className="text-3xl font-black tracking-tighter">Koç Analiz Ediyor</h3>
                    <p className="text-zinc-500 text-sm mt-3 max-w-[250px] mx-auto">Performansın inceleniyor ve kelime dağarcığın bilimsel olarak işleniyor...</p>
                </div>
            )}
        </div>
    );
};
