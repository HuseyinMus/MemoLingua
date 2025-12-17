
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ArrowLeft, Mic, MicOff, Sparkles, Waves, Loader2, X, History, Trophy, TrendingUp, CheckCircle, Clock, GraduationCap, BookOpen, Fingerprint, Zap, ChevronRight } from 'lucide-react';
import { UserProfile, UserWord, VoiceSession, ChatMessage } from '../types';
import { db } from '../services/firebase';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { summarizeVoiceSession } from '../services/geminiService';

interface VoiceTalkProps {
    userProfile: UserProfile | null;
    recentWords: UserWord[];
    onBack: () => void;
}

const EXAM_SCENARIOS = [
    { id: 'mastery', label: 'Vocab Mastery', subLabel: 'Kendi kelimelerinle pratik', icon: Sparkles, color: 'from-zinc-200 to-zinc-400' },
    { id: 'ielts', label: 'IELTS Speaking', subLabel: 'Band 9 Interview', icon: GraduationCap, color: 'from-indigo-400 to-indigo-600' },
    { id: 'toefl', label: 'TOEFL iBT', subLabel: 'Academic Task', icon: BookOpen, color: 'from-amber-400 to-amber-600' },
    { id: 'sat', label: 'SAT Verbal', subLabel: 'High Rhetoric', icon: Fingerprint, color: 'from-rose-400 to-rose-600' },
];

export const VoiceTalk: React.FC<VoiceTalkProps> = ({ userProfile, recentWords, onBack }) => {
    const [view, setView] = useState<'menu' | 'active' | 'history' | 'report'>('menu');
    const [isActive, setIsActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    const [transcriptHistory, setTranscriptHistory] = useState<ChatMessage[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [currentOutput, setCurrentOutput] = useState('');
    const [selectedScenario, setSelectedScenario] = useState(EXAM_SCENARIOS[0]);
    const [isMuted, setIsMuted] = useState(false);
    
    const [sessions, setSessions] = useState<VoiceSession[]>([]);
    const [currentReport, setCurrentReport] = useState<NonNullable<VoiceSession['analysis']>>({
        fluencyScore: 0, grammarFeedback: '', vocabularyUsed: [], suggestions: []
    });
    const [sessionDuration, setSessionDuration] = useState(0);
    const timerRef = useRef<any>(null);

    const sessionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const historyEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!userProfile?.uid) return;
        const q = query(
            collection(db, "users", userProfile.uid, "voiceSessions"),
            orderBy("timestamp", "desc")
        );
        return onSnapshot(q, (snapshot) => {
            setSessions(snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    ...data, 
                    id: doc.id,
                    // Firestore Timestamp nesnelerini sayıya çevirerek dairesel yapı hatalarını önle
                    timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : (Number(data.timestamp) || Date.now())
                } as VoiceSession;
            }));
        }, (error) => {
            console.warn("Sessiz hata: Geçmiş yüklenemedi.");
        });
    }, [userProfile?.uid]);

    useEffect(() => {
        historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcriptHistory, currentInput, currentOutput]);

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
        setTranscriptHistory([]);
        setSessionDuration(0);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = outputCtx;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const targetVocab = recentWords.map(w => `${w.term} (${w.translation})`).join(', ');

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        const source = inputCtx.createMediaStreamSource(stream);
                        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (e) => {
                            if (isMuted) return;
                            const inputData = e.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
                            const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputCtx.destination);
                        setIsConnecting(false);
                        setIsActive(true);
                        setView('active');
                        timerRef.current = setInterval(() => setSessionDuration(d => d + 1), 1000);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        if (msg.serverContent?.inputTranscription) {
                            setCurrentInput(prev => prev + msg.serverContent!.inputTranscription!.text);
                        }
                        if (msg.serverContent?.outputTranscription) {
                            setCurrentOutput(prev => prev + msg.serverContent!.outputTranscription!.text);
                        }
                        if (msg.serverContent?.turnComplete) {
                            const newEntries: ChatMessage[] = [];
                            if (currentInput) newEntries.push({ id: crypto.randomUUID(), role: 'user', text: currentInput, timestamp: Date.now() });
                            if (currentOutput) newEntries.push({ id: crypto.randomUUID(), role: 'ai', text: currentOutput, timestamp: Date.now() });
                            
                            setTranscriptHistory(prev => [...prev, ...newEntries]);
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
                    systemInstruction: `Sen bir sesli eğitmen olan Zephyr'sin. 
                    Mod: ${selectedScenario.label}. Önemli Kelimeler: ${targetVocab}.
                    Öğrencinin bu kelimeleri kullanmasını sağla. IELTS/TOEFL/SAT modundaysan sınav simülasyonu yap.
                    Yanlışları anında, nazikçe düzelt. Kısa ve doğal konuş.`,
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (e) {
            console.error("Session start error:", e);
            setIsConnecting(false);
        }
    };

    const stopSession = async () => {
        clearInterval(timerRef.current);
        sessionRef.current?.close();
        streamRef.current?.getTracks().forEach(t => t.stop());
        setIsActive(false);
        setIsConnecting(false);

        if (transcriptHistory.length > 1) {
            setIsAnalyzing(true);
            try {
                const analysis = await summarizeVoiceSession(transcriptHistory, userProfile?.level || 'A1');
                setCurrentReport(analysis);
                
                if (userProfile?.uid) {
                    try {
                        await addDoc(collection(db, "users", userProfile.uid, "voiceSessions"), {
                            timestamp: Date.now(),
                            scenario: selectedScenario.label,
                            duration: sessionDuration,
                            transcript: transcriptHistory,
                            analysis
                        });
                    } catch (dbErr) {
                        console.warn("Kayıt atlandı.");
                    }
                }
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

    return (
        <div className="h-full w-full bg-[#050505] text-[#FAFAFA] flex flex-col animate-fade-in relative overflow-hidden font-sans">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1a1a1a_0%,_#050505_100%)] pointer-events-none"></div>

            {/* Header - More compact */}
            <header className="flex items-center justify-between p-5 pt-8 shrink-0 z-50">
                <button 
                    onClick={view === 'menu' ? onBack : () => setView('menu')} 
                    className="p-2.5 bg-zinc-900/40 backdrop-blur-2xl border border-zinc-800 rounded-2xl active:scale-95 transition-all"
                >
                    <ArrowLeft size={18} className="text-zinc-400" />
                </button>
                
                <div className="flex flex-col items-center">
                    <h2 className="text-[8px] font-black tracking-[0.4em] uppercase text-zinc-600 mb-0.5">Intelligence</h2>
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-indigo-400 shadow-[0_0_8px_indigo] animate-pulse' : 'bg-zinc-800'}`}></div>
                        <span className="text-[10px] font-bold text-zinc-400 font-mono">
                            {isActive ? `${Math.floor(sessionDuration / 60)}:${(sessionDuration % 60).toString().padStart(2, '0')}` : 'READY'}
                        </span>
                    </div>
                </div>

                <button 
                    onClick={() => setView('history')}
                    className="p-2.5 bg-zinc-900/40 backdrop-blur-2xl border border-zinc-800 rounded-2xl text-zinc-400 transition-all"
                >
                    <History size={18} />
                </button>
            </header>

            <div className="flex-1 overflow-hidden relative z-10 flex flex-col">
                
                {/* 1. SEÇİM MENÜSÜ */}
                {view === 'menu' && (
                    <div className="h-full flex flex-col p-6 animate-fade-in justify-center max-w-sm mx-auto w-full">
                        <div className="text-center mb-6">
                            <h3 className="text-2xl font-black mb-1.5 tracking-tighter text-white">Akademik Koç</h3>
                            <p className="text-zinc-500 font-medium text-[11px] leading-relaxed">Öğrendiğin kelimelerle sınav simülasyonları yap.</p>
                        </div>
                        
                        <div className="space-y-2 mb-8">
                            {EXAM_SCENARIOS.map((s) => (
                                <button 
                                    key={s.id}
                                    onClick={() => setSelectedScenario(s)}
                                    className={`p-3.5 rounded-[1.8rem] border transition-all flex items-center gap-4 w-full group ${selectedScenario.id === s.id ? 'bg-zinc-900 border-zinc-700 shadow-xl' : 'bg-transparent border-transparent text-zinc-600 hover:text-zinc-400'}`}
                                >
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} text-zinc-950 flex items-center justify-center shadow-lg`}>
                                        <s.icon size={18} strokeWidth={2.5} />
                                    </div>
                                    <div className="text-left flex-1">
                                        <h4 className={`text-[11px] font-black uppercase tracking-widest ${selectedScenario.id === s.id ? 'text-white' : 'text-zinc-500'}`}>{s.label}</h4>
                                        <p className="text-[9px] text-zinc-600 font-bold">{s.subLabel}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <button 
                            onClick={startSession}
                            disabled={isConnecting}
                            className="w-full py-4 bg-white text-zinc-950 font-black rounded-[2rem] shadow-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 text-xs tracking-wider"
                        >
                            {isConnecting ? <Loader2 className="animate-spin size={16}" /> : <Zap size={16} fill="currentColor" />}
                            {isConnecting ? 'DÜŞÜNÜLÜYOR...' : 'SİMÜLASYONU BAŞLAT'}
                        </button>
                    </div>
                )}

                {/* 2. AKTİF KONUŞMA */}
                {view === 'active' && (
                    <div className="h-full flex flex-col px-6 py-2 animate-fade-in relative items-center justify-center">
                        {/* THE LIQUID ORB - Lifted and smaller */}
                        <div className="relative w-48 h-48 flex items-center justify-center -mt-16">
                            <div className={`absolute inset-0 rounded-full bg-indigo-500/10 transition-all duration-[1500ms] ${currentOutput ? 'scale-150 blur-2xl opacity-30' : 'scale-100 blur-xl opacity-0'}`}></div>
                            <div className={`absolute inset-4 rounded-full bg-zinc-800/40 border border-zinc-700/50 transition-all duration-[2000ms] ${currentOutput ? 'scale-110 opacity-100' : 'scale-90 opacity-0'}`}></div>
                            
                            <div className={`w-28 h-28 rounded-full bg-white shadow-[0_0_60px_rgba(255,255,255,0.1)] flex items-center justify-center overflow-hidden transition-all duration-500 ${currentOutput ? 'scale-110' : 'scale-100'}`}>
                                <Waves size={32} className={`text-zinc-950 transition-all duration-500 ${currentOutput ? 'scale-125 animate-pulse' : 'scale-75 opacity-10'}`} />
                            </div>
                        </div>

                        {/* Altyazı - Compact text and centered */}
                        <div className="mt-8 w-full text-center px-2 max-w-xs h-32 flex flex-col justify-center">
                            {currentOutput ? (
                                <div className="animate-fade-in">
                                    <p className="text-lg font-bold text-white leading-tight tracking-tight px-2">
                                        {currentOutput}
                                    </p>
                                </div>
                            ) : currentInput ? (
                                <div className="animate-pulse">
                                    <p className="text-sm font-medium text-zinc-500 italic">
                                        "{currentInput}..."
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4 opacity-30">
                                    <div className="flex gap-1.5">
                                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{animationDelay:'0s'}}></div>
                                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></div>
                                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{animationDelay:'0.4s'}}></div>
                                    </div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.6em]">Listening</p>
                                </div>
                            )}
                        </div>

                        {/* Kelime Rozeti */}
                        <div className="mt-auto mb-6 px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-center gap-2">
                             <div className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse"></div>
                             <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Focus: {recentWords[0]?.term || 'Active Session'}</span>
                        </div>

                        {/* Control Bar - Lifted significantly for mobile UI */}
                        <div className="w-full max-w-xs flex items-center justify-between pb-16">
                             <button 
                                onClick={() => setIsMuted(!isMuted)}
                                className={`p-4 rounded-[2rem] border transition-all ${isMuted ? 'bg-red-500/10 border-red-500/30 text-red-500 shadow-xl' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                             >
                                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                             </button>
                             
                             <button 
                                onClick={stopSession}
                                className="px-8 py-4 bg-red-600/10 text-red-500 font-black rounded-[2rem] border border-red-500/20 shadow-2xl flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-red-600 hover:text-white text-xs"
                             >
                                <X size={16} strokeWidth={3} /> BITIR
                             </button>
                        </div>
                    </div>
                )}

                {/* 3. RAPOR EKRANI */}
                {view === 'report' && (
                    <div className="h-full flex flex-col p-6 overflow-y-auto scrollbar-hide animate-slide-up pb-32 max-w-sm mx-auto w-full">
                         <div className="bg-zinc-900 p-6 rounded-[3rem] border border-zinc-800 shadow-2xl text-white mb-6 text-center relative overflow-hidden">
                             <div className="absolute inset-0 bg-indigo-500/5 blur-3xl"></div>
                             <p className="text-[8px] font-black opacity-40 uppercase tracking-[0.3em] mb-2">Assessment</p>
                             <h3 className="text-5xl font-black tracking-tighter mb-2 text-white">%{currentReport.fluencyScore}</h3>
                             <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 w-fit px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest mx-auto border border-indigo-500/20">
                                <Trophy size={10} /> Proficiency: {currentReport.fluencyScore > 80 ? 'High' : 'Good'}
                             </div>
                         </div>

                         <div className="space-y-3">
                            <section className="bg-zinc-900/50 p-5 rounded-[2rem] border border-zinc-800">
                                <h4 className="flex items-center gap-2 font-black text-[8px] uppercase tracking-[0.2em] mb-3 text-zinc-500">
                                    <Sparkles size={14} className="text-indigo-400" /> Analiz
                                </h4>
                                <p className="text-[11px] leading-relaxed text-zinc-300 font-medium">{currentReport.grammarFeedback}</p>
                            </section>

                            <section className="bg-zinc-900/50 p-5 rounded-[2rem] border border-zinc-800">
                                <h4 className="flex items-center gap-2 font-black text-[8px] uppercase tracking-[0.2em] mb-3 text-zinc-500">
                                    <CheckCircle size={14} className="text-emerald-400" /> Kelimeler
                                </h4>
                                <div className="flex flex-wrap gap-1">
                                    {currentReport.vocabularyUsed.map((word, i) => (
                                        <div key={i} className="px-2.5 py-1 bg-white/5 border border-zinc-800 rounded-lg text-zinc-200 text-[9px] font-bold">
                                            {word}
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="bg-zinc-900/50 p-5 rounded-[2rem] border border-zinc-800">
                                <h4 className="flex items-center gap-2 font-black text-[8px] uppercase tracking-[0.2em] mb-3 text-zinc-500">
                                    <TrendingUp size={14} className="text-amber-400" /> Tavsiyeler
                                </h4>
                                <ul className="space-y-2">
                                    {currentReport.suggestions.map((s, i) => (
                                        <li key={i} className="flex gap-2 text-[10px] text-zinc-400 font-medium leading-normal">
                                            <div className="w-0.5 h-0.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                         </div>

                         <button 
                            onClick={() => setView('menu')}
                            className="w-full py-4 bg-white text-zinc-950 font-black rounded-[2rem] mt-8 shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest"
                         >
                            ANA MENÜ <ArrowLeft className="rotate-180" size={14} />
                         </button>
                    </div>
                )}

                {/* 4. GEÇMİŞ EKRANI */}
                {view === 'history' && (
                    <div className="h-full flex flex-col p-6 overflow-y-auto scrollbar-hide animate-slide-up pb-32 max-w-sm mx-auto w-full">
                        <div className="mb-6">
                            <h3 className="text-2xl font-black mb-1 tracking-tighter text-white">Arşiv</h3>
                            <p className="text-zinc-600 text-[10px] font-medium italic">Geçmiş performansların.</p>
                        </div>

                        {sessions.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 py-12">
                                <div className="p-8 bg-zinc-900 rounded-[2.5rem] border border-zinc-800 mb-4">
                                    <History size={40} className="text-zinc-700" />
                                </div>
                                <p className="font-black text-sm text-zinc-500 tracking-tighter">Kayıt Bulunmadı</p>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {sessions.map((s) => (
                                    <button 
                                        key={s.id} 
                                        onClick={() => {
                                            setCurrentReport(s.analysis!);
                                            setTranscriptHistory(s.transcript);
                                            setSessionDuration(s.duration);
                                            setView('report');
                                        }}
                                        className="w-full bg-zinc-900/40 p-4 rounded-[1.5rem] border border-zinc-800 flex items-center justify-between group hover:bg-zinc-800 transition-all text-left"
                                    >
                                        <div className="flex-1 pr-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-black text-[10px] text-zinc-200">{s.scenario}</h4>
                                                <div className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded-md text-[7px] font-black text-indigo-400">%{s.analysis?.fluencyScore || 0}</div>
                                            </div>
                                            <div className="flex items-center gap-3 text-zinc-600 text-[8px] font-bold uppercase tracking-widest">
                                                <div className="flex items-center gap-1"><Clock size={8}/> {Math.floor(s.duration / 60)} dk</div>
                                                <div>{new Date(s.timestamp).toLocaleDateString('tr-TR')}</div>
                                            </div>
                                        </div>
                                        <ChevronRight size={14} className="text-zinc-600" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* AI Analyzer Overlay */}
            {isAnalyzing && (
                <div className="fixed inset-0 z-[200] bg-[#050505]/98 backdrop-blur-3xl flex flex-col items-center justify-center p-10 animate-fade-in text-center">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-white blur-[60px] opacity-10 animate-pulse"></div>
                        <Loader2 size={56} className="text-white animate-spin relative z-10" />
                    </div>
                    <h3 className="text-xl font-black text-white tracking-tighter mb-2">Değerlendiriliyor</h3>
                    <p className="text-[11px] text-zinc-500 font-medium leading-relaxed max-w-[220px] mx-auto">Zephyr tüm diyaloğu en ince detayına kadar tarıyor...</p>
                    
                    <div className="mt-8 flex gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-zinc-800 animate-bounce" style={{animationDelay:'0s'}}></div>
                        <div className="w-1 h-1 rounded-full bg-zinc-800 animate-bounce" style={{animationDelay:'0.2s'}}></div>
                        <div className="w-1 h-1 rounded-full bg-zinc-800 animate-bounce" style={{animationDelay:'0.4s'}}></div>
                    </div>
                </div>
            )}
        </div>
    );
};
