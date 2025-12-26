
import React, { useState } from 'react';
import { BookOpen, Sparkles, Wand2, Plus, Volume2, Play, CheckCircle2, Loader2, ArrowRight, MessageSquare, ListCheck, Edit3, Send, Trophy, AlertCircle, X, Check, Layers, Languages, Coffee, Briefcase, Plane, ShoppingBag, HeartPulse } from 'lucide-react';
import { UserLevel, GeneratedStory, WordData, WritingFeedback } from '../types';
import { generateContextualStory, generatePhrasalVerbBatch, playGeminiAudio, generateAudio, evaluateWriting } from '../services/geminiService';
import { audioManager } from '../services/audioManager';

interface StudioProps {
    userLevel: UserLevel;
    onAddWords: (words: WordData[]) => void;
    onAddXP: (amount: number) => void;
}

const WRITING_PROMPTS = [
    "Hayalindeki tatili anlat.",
    "En sevdiğin film karakteri sence neden o kadar etkileyici?",
    "Gelecekte teknolojinin eğitimi nasıl değiştireceğini düşünüyorsun?",
    "Daha iyi bir dünya için bir icat yapsan, bu ne olurdu?",
    "Çocukluğunun geçtiği mahalledeki bir anını yaz."
];

const COMMON_BASE_VERBS = ["get", "look", "take", "go", "set", "put", "bring", "come", "keep", "break"];

const PHRASAL_TOPICS = [
    { id: 'business', label: 'İş & Kariyer', icon: Briefcase, color: 'text-blue-500' },
    { id: 'travel', label: 'Seyahat', icon: Plane, color: 'text-orange-500' },
    { id: 'social', label: 'Sosyal Yaşam', icon: Coffee, color: 'text-purple-500' },
    { id: 'shopping', label: 'Alışveriş', icon: ShoppingBag, color: 'text-green-500' },
    { id: 'health', label: 'Sağlık', icon: HeartPulse, color: 'text-red-500' },
];

export const Studio: React.FC<StudioProps> = ({ userLevel, onAddWords, onAddXP }) => {
    const [activeMode, setActiveMode] = useState<'menu' | 'story' | 'writing' | 'phrasal'>('menu');
    const [topic, setTopic] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeStory, setActiveStory] = useState<GeneratedStory | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Writing Lab States
    const [writingPrompt, setWritingPrompt] = useState('');
    const [userText, setUserText] = useState('');
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [writingFeedback, setWritingFeedback] = useState<WritingFeedback | null>(null);

    // Phrasal Verbs States
    const [baseVerb, setBaseVerb] = useState('get');
    const [phrasalTone, setPhrasalTone] = useState<'formal' | 'informal'>('informal');
    const [phrasalTopic, setPhrasalTopic] = useState('business');
    const [customPhrasalTopic, setCustomPhrasalTopic] = useState('');
    const [phrasalList, setPhrasalList] = useState<WordData[]>([]);

    const handleStartWriting = () => {
        setWritingPrompt(WRITING_PROMPTS[Math.floor(Math.random() * WRITING_PROMPTS.length)]);
        setActiveMode('writing');
        setWritingFeedback(null);
        setUserText('');
    };

    const handleEvaluateWriting = async () => {
        if (userText.length < 20) return;
        setIsEvaluating(true);
        try {
            const feedback = await evaluateWriting(userText, userLevel);
            setWritingFeedback(feedback);
            onAddXP(Math.max(10, Math.floor(feedback.score / 2)));
        } catch (e) { } finally { setIsEvaluating(false); }
    };

    const handleGenerateStory = async () => {
        if (!topic.trim()) return;
        setIsGenerating(true);
        try {
            const story = await generateContextualStory(userLevel, topic);
            setActiveStory({ ...story, id: crypto.randomUUID(), date: Date.now() });
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGeneratePhrasals = async () => {
        setIsGenerating(true);
        try {
            const finalTopic = customPhrasalTopic || phrasalTopic;
            const list = await generatePhrasalVerbBatch(5, userLevel, baseVerb, phrasalTone, [], finalTopic);
            setPhrasalList(list);
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const speakStory = async () => {
        if (!activeStory || isPlaying) return;
        setIsPlaying(true);
        try {
            await audioManager.speak(activeStory.content, { useAIFirst: true, timeout: 8000 });
        } finally { setIsPlaying(false); }
    };

    const speakWord = async (text: string) => {
        await audioManager.speak(text);
    };

    if (activeMode === 'writing') {
        return (
            <div className="h-full w-full bg-zinc-50 dark:bg-zinc-950 flex flex-col p-6 animate-fade-in overflow-y-auto scrollbar-hide pb-32">
                <header className="pt-8 mb-6 flex items-center justify-between">
                    <button onClick={() => setActiveMode('menu')} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full"><ArrowRight className="rotate-180" /></button>
                    <h2 className="text-xl font-black">Yazma Atölyesi</h2>
                    <div className="w-10"></div>
                </header>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm mb-6">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Günün Konusu</p>
                    <h3 className="text-lg font-bold text-black dark:text-white leading-tight">"{writingPrompt}"</h3>
                </div>

                {!writingFeedback ? (
                    <div className="flex-1 flex flex-col">
                        <textarea
                            value={userText}
                            onChange={(e) => setUserText(e.target.value)}
                            placeholder="İngilizce yazmaya başla..."
                            className="flex-1 w-full bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border-2 border-transparent focus:border-indigo-500 outline-none text-zinc-800 dark:text-zinc-200 font-medium resize-none shadow-sm min-h-[200px]"
                        />
                        <div className="mt-4 flex justify-between items-center px-2">
                            <p className="text-xs text-zinc-400 font-bold">{userText.split(' ').filter(Boolean).length} Kelime</p>
                            <button
                                onClick={handleEvaluateWriting}
                                disabled={isEvaluating || userText.length < 20}
                                className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isEvaluating ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                Değerlendir
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="animate-slide-up space-y-6">
                        <div className="bg-black dark:bg-zinc-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                            <div className="relative z-10 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">Başarı Puanı</p>
                                    <h3 className="text-5xl font-black">%{writingFeedback.score}</h3>
                                    <span className="inline-block mt-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold">{writingFeedback.cefrLevel} Level</span>
                                </div>
                                <Trophy size={64} className="opacity-20 text-yellow-400" />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800">
                            <h4 className="font-bold mb-3 flex items-center gap-2"><Sparkles size={18} className="text-indigo-500" /> AI Değerlendirmesi</h4>
                            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{writingFeedback.feedback}</p>
                        </div>

                        <div className="space-y-4">
                            <h4 className="font-bold px-2 text-sm text-zinc-400 uppercase">Düzeltmeler</h4>
                            {writingFeedback.corrections.map((c, i) => (
                                <div key={i} className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border-l-4 border-red-500 shadow-sm">
                                    <div className="flex items-start gap-3 mb-2">
                                        <X size={14} className="text-red-500 mt-1 shrink-0" />
                                        <p className="text-sm text-zinc-500 line-through">"{c.original}"</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Check size={14} className="text-green-500 mt-1 shrink-0" />
                                        <p className="text-sm font-bold text-black dark:text-white">"{c.corrected}"</p>
                                    </div>
                                    <p className="mt-2 text-[10px] italic text-zinc-400 ml-6">Neden: {c.reason}</p>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => { setWritingFeedback(null); setUserText(''); handleStartWriting(); }}
                            className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white rounded-2xl font-black mt-4"
                        >
                            Yeni Konu Dene
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (activeMode === 'phrasal') {
        return (
            <div className="h-full w-full bg-zinc-50 dark:bg-zinc-950 flex flex-col p-6 animate-fade-in overflow-y-auto scrollbar-hide pb-32">
                <header className="pt-8 mb-6 flex items-center justify-between">
                    <button onClick={() => { setActiveMode('menu'); setPhrasalList([]); }} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full"><ArrowRight className="rotate-180" /></button>
                    <h2 className="text-xl font-black">Phrasal Verbs</h2>
                    <div className="w-10"></div>
                </header>

                {phrasalList.length === 0 ? (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                            <h3 className="text-lg font-bold mb-6">Kelime Seç ve Öğren</h3>

                            <div className="mb-6">
                                <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3">Ana Fiil</p>
                                <div className="flex flex-wrap gap-2">
                                    {COMMON_BASE_VERBS.map(v => (
                                        <button
                                            key={v}
                                            onClick={() => setBaseVerb(v)}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${baseVerb === v ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 text-zinc-500'}`}
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-6">
                                <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3">Bağlam / Konu Seç</p>
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    {PHRASAL_TOPICS.map(t => {
                                        const Icon = t.icon;
                                        const isSelected = phrasalTopic === t.id && !customPhrasalTopic;
                                        return (
                                            <button
                                                key={t.id}
                                                onClick={() => { setPhrasalTopic(t.id); setCustomPhrasalTopic(''); }}
                                                className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${isSelected ? 'bg-white dark:bg-zinc-800 border-black dark:border-white ring-2 ring-black dark:ring-white ring-offset-2 dark:ring-offset-zinc-900' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-800'}`}
                                            >
                                                <Icon size={18} className={t.color} />
                                                <span className="text-xs font-bold">{t.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="relative">
                                    <input
                                        value={customPhrasalTopic}
                                        onChange={(e) => { setCustomPhrasalTopic(e.target.value); setPhrasalTopic(''); }}
                                        placeholder="Veya kendi konunu yaz..."
                                        className="w-full bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl text-xs font-bold border-2 border-transparent focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="mb-8">
                                <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3">Dil Tarzı</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setPhrasalTone('informal')}
                                        className={`py-3 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 transition-all ${phrasalTone === 'informal' ? 'bg-orange-500 text-white border-orange-500' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 text-zinc-500'}`}
                                    >
                                        <MessageSquare size={16} /> Günlük (Informal)
                                    </button>
                                    <button
                                        onClick={() => setPhrasalTone('formal')}
                                        className={`py-3 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 transition-all ${phrasalTone === 'formal' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 text-zinc-500'}`}
                                    >
                                        <Languages size={16} /> Resmi (Formal)
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleGeneratePhrasals}
                                disabled={isGenerating}
                                className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                                {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                                {isGenerating ? 'Hazırlanıyor...' : 'Listeyi Oluştur'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="animate-slide-up space-y-4">
                        <div className={`p-8 rounded-[2.5rem] ${phrasalTone === 'formal' ? 'bg-indigo-600' : 'bg-orange-500'} text-white shadow-xl mb-6`}>
                            <h3 className="text-3xl font-black mb-1 capitalize">{baseVerb}</h3>
                            <p className="text-white/70 font-bold uppercase text-[10px] tracking-widest">
                                {phrasalTone} • {customPhrasalTopic || PHRASAL_TOPICS.find(t => t.id === phrasalTopic)?.label || 'Genel'}
                            </p>
                        </div>

                        <div className="space-y-3">
                            {phrasalList.map((item) => (
                                <div key={item.id} className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="text-xl font-black text-black dark:text-white">{item.term}</h4>
                                            <p className="text-sm text-zinc-500 font-bold">{item.translation}</p>
                                        </div>
                                        <button onClick={() => speakWord(item.term)} className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-full text-zinc-400 hover:text-indigo-500 transition-colors">
                                            <Volume2 size={18} />
                                        </button>
                                    </div>
                                    <p className="text-xs text-zinc-600 dark:text-zinc-400 italic mb-3">"{item.definition}"</p>
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl text-[11px] font-medium text-zinc-500 mb-4">
                                        <p className="font-bold text-[9px] uppercase tracking-widest text-zinc-400 mb-1">Örnek</p>
                                        {item.exampleSentence}
                                    </div>
                                    <button
                                        onClick={() => {
                                            onAddWords([item]);
                                            setPhrasalList(prev => prev.filter(p => p.id !== item.id));
                                        }}
                                        className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white rounded-xl font-bold text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                                    >
                                        Koleksiyona Ekle
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => { setPhrasalList([]); handleGeneratePhrasals(); }}
                            className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 font-black rounded-2xl mt-4"
                        >
                            Daha Fazla {baseVerb.toUpperCase()} Keşfet
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-zinc-50 dark:bg-zinc-950 flex flex-col p-6 animate-fade-in overflow-y-auto scrollbar-hide pb-32">
            <header className="pt-8 mb-8">
                <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-2">Stüdyo</h2>
                <p className="text-zinc-500 font-medium">Kişisel öğrenim materyallerini AI ile tasarla.</p>
            </header>

            {activeMode === 'menu' && (
                <div className="grid grid-cols-1 gap-4">
                    <button
                        onClick={() => setActiveMode('story')}
                        className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-left active:scale-95 transition-all group"
                    >
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-600 mb-6 group-hover:scale-110 transition-transform"><BookOpen /></div>
                        <h3 className="text-xl font-bold mb-1">Hikaye Fabrikası</h3>
                        <p className="text-xs text-zinc-500 font-medium">İlgi alanına göre AI hikayeleri yazdır.</p>
                    </button>

                    <button
                        onClick={handleStartWriting}
                        className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-left active:scale-95 transition-all group"
                    >
                        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center text-orange-600 mb-6 group-hover:scale-110 transition-transform"><Edit3 /></div>
                        <h3 className="text-xl font-bold mb-1">Yazma Atölyesi</h3>
                        <p className="text-xs text-zinc-500 font-medium">AI değerlendirmeli İngilizce kompozisyon yaz.</p>
                    </button>

                    <button
                        onClick={() => setActiveMode('phrasal')}
                        className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm text-left active:scale-95 transition-all group"
                    >
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform"><Layers /></div>
                        <h3 className="text-xl font-bold mb-1">Phrasal Verbs</h3>
                        <p className="text-xs text-zinc-500 font-medium">Formal ve Informal öbek fiiller öğren.</p>
                    </button>

                    <div className="p-8 rounded-[2.5rem] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center opacity-40">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Çok Yakında</p>
                        <h3 className="text-sm font-bold">Kişiselleştirilmiş Diyaloglar</h3>
                    </div>
                </div>
            )}

            {activeMode === 'story' && !activeStory && (
                <div className="animate-slide-up">
                    <button onClick={() => setActiveMode('menu')} className="flex items-center gap-2 text-zinc-400 font-bold text-sm mb-6"><ArrowRight className="rotate-180" size={16} /> Geri</button>
                    <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 p-8 shadow-sm">
                        <h3 className="text-xl font-bold text-black dark:text-white mb-4">Ne hakkında yazalım?</h3>
                        <div className="relative mb-6">
                            <input
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="Örn: Cyberpunk bir gelecek..."
                                className="w-full bg-zinc-50 dark:bg-zinc-800 p-4 pr-12 rounded-2xl border-2 border-transparent focus:border-purple-500 outline-none text-black dark:text-white font-bold"
                            />
                        </div>
                        <button
                            onClick={handleGenerateStory}
                            disabled={isGenerating || !topic}
                            className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                            {isGenerating ? 'Yazılıyor...' : 'Hikayeyi Üret'}
                        </button>
                    </div>
                </div>
            )}

            {activeStory && activeMode === 'story' && (
                <div className="animate-slide-up space-y-6">
                    <button onClick={() => setActiveStory(null)} className="flex items-center gap-2 text-zinc-400 font-bold text-sm mb-4"><ArrowRight className="rotate-180" size={16} /> Geri</button>
                    <div className={`p-8 rounded-[3rem] ${activeStory.coverGradient} text-white shadow-2xl relative overflow-hidden mb-8`}>
                        <h3 className="text-3xl font-black mb-2 leading-tight">{activeStory.title}</h3>
                        <p className="text-white/60 font-black text-[10px] uppercase tracking-widest">{activeStory.genre} • {activeStory.level}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-zinc-100 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="font-bold text-lg">Hikaye</h4>
                            <button onClick={speakStory} className={`p-3 rounded-full bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white ${isPlaying ? 'animate-pulse text-indigo-500' : ''}`}>
                                <Volume2 size={20} />
                            </button>
                        </div>
                        <p className="text-base leading-relaxed text-zinc-800 dark:text-zinc-200 font-serif italic mb-8 whitespace-pre-wrap">{activeStory.content}</p>
                        <button onClick={() => { onAddWords(activeStory.vocabulary); setActiveStory(null); }} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">Tüm Kelimeleri Ekle</button>
                    </div>
                </div>
            )}
        </div>
    );
};
