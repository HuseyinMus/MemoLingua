
import React, { useState, useMemo, useRef } from 'react';
import { Search, Plus, Loader2, Sparkles, X, Check, Brain, Zap, ArrowRight, Camera, Image as ImageIcon, Briefcase, Plane, Book, Coffee, Globe, Hash, Volume2, Info, BookOpen, Lightbulb, ExternalLink, Languages, Palette, Music } from 'lucide-react';
import { UserLevel, WordData, UserProfile, UserWord } from '../types';
import { generateSingleWord, extractVocabularyFromImage, generateDailyBatch, playGeminiAudio, generateAudio } from '../services/geminiService';
import { Shimmer } from './Shimmer';

interface DiscoverProps {
    userProfile: UserProfile | null;
    words: UserWord[];
    needsDailyBatch: boolean;
    isGeneratingDaily: boolean;
    onGenerateDaily: () => void;
    onAddWord: (word: WordData) => void;
    onAddXP: (amount: number) => void;
}

const DISCOVERY_THEMES = [
    { id: 'tech', label: 'Teknoloji', subLabel: 'Dijital Gelecek', icon: Globe, gradient: 'from-blue-600 to-cyan-500', shadow: 'shadow-blue-500/30', prompt: 'Modern technology, AI, coding, and gadgets' },
    { id: 'business', label: 'İş Dünyası', subLabel: 'Profesyonel Yaşam', icon: Briefcase, gradient: 'from-indigo-600 to-purple-600', shadow: 'shadow-indigo-500/30', prompt: 'Professional business communication and economy' },
    { id: 'travel', label: 'Seyahat', subLabel: 'Dünya Turu', icon: Plane, gradient: 'from-emerald-500 to-teal-400', shadow: 'shadow-emerald-500/30', prompt: 'Travel, airports, hotels and exploration' },
    { id: 'academic', label: 'Akademik', subLabel: 'Bilim & Araştırma', icon: Book, gradient: 'from-violet-600 to-fuchsia-600', shadow: 'shadow-violet-500/30', prompt: 'Academic research, science and university life' },
    { id: 'daily', label: 'Günlük', subLabel: 'Yaşam & Sohbet', icon: Coffee, gradient: 'from-orange-500 to-amber-500', shadow: 'shadow-orange-500/30', prompt: 'Everyday casual conversation and lifestyle' },
    { id: 'art', label: 'Sanat & Kültür', subLabel: 'Yaratıcılık', icon: Palette, gradient: 'from-pink-500 to-rose-500', shadow: 'shadow-pink-500/30', prompt: 'Art, music, cinema and culture' },
];

export const Discover: React.FC<DiscoverProps> = ({ 
    userProfile, 
    words, 
    needsDailyBatch, 
    isGeneratingDaily, 
    onGenerateDaily, 
    onAddWord,
    onAddXP
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isQuickCreating, setIsQuickCreating] = useState(false);
    const [isScanningImage, setIsScanningImage] = useState(false);
    const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);
    const [discoveredWords, setDiscoveredWords] = useState<WordData[]>([]);
    const [previewWord, setPreviewWord] = useState<WordData | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isGlobalLoading = isQuickCreating || isScanningImage || isGeneratingTheme || isGeneratingDaily;

    const filteredLocalWords = useMemo(() => {
        if (!searchTerm.trim()) return [];
        return words.filter(w => 
            w.term.toLowerCase().includes(searchTerm.toLowerCase()) || 
            w.translation.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 3);
    }, [words, searchTerm]);

    const handleQuickCreate = async () => {
        if (!searchTerm.trim() || isGlobalLoading || !userProfile) return;
        setIsQuickCreating(true);
        try {
            const wordData = await generateSingleWord(searchTerm, userProfile.level);
            setDiscoveredWords(prev => [wordData, ...prev]);
            setSearchTerm('');
            setPreviewWord(wordData); // Automatically show details for the searched word
            onAddXP(15);
        } catch (e) {
            console.error(e);
        } finally {
            setIsQuickCreating(false);
        }
    };

    const handleThemeDiscovery = async (themePrompt: string) => {
        if (isGlobalLoading || !userProfile) return;
        setIsGeneratingTheme(true);
        try {
            const newWords = await generateDailyBatch(5, userProfile.level, themePrompt as any, words.map(w => w.term));
            setDiscoveredWords(prev => [...newWords, ...prev]);
            onAddXP(20);
        } catch (e) {
            console.error(e);
        } finally {
            setIsGeneratingTheme(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userProfile || isGlobalLoading) return;

        setIsScanningImage(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const newWords = await extractVocabularyFromImage(base64, userProfile.level);
                setDiscoveredWords(prev => [...newWords, ...prev]);
                onAddXP(30);
                setIsScanningImage(false);
            };
            reader.readAsDataURL(file);
        } catch (e) {
            console.error(e);
            setIsScanningImage(false);
        }
    };

    const handleSpeak = async (text: string) => {
        if (isSpeaking) return;
        setIsSpeaking(true);
        try {
            const base64 = await generateAudio(text);
            if (base64) await playGeminiAudio(base64);
        } catch (e) {} finally { setIsSpeaking(false); }
    };

    const handleAddDiscoveredWord = (word: WordData) => {
        onAddWord(word);
        setDiscoveredWords(prev => prev.filter(w => w.id !== word.id));
        setPreviewWord(null);
    };

    return (
        <div className="h-full w-full bg-zinc-50 dark:bg-zinc-950 flex flex-col p-6 animate-fade-in overflow-y-auto scrollbar-hide pb-32 relative">
            
            {/* AI Generation Loading Overlay */}
            {isGlobalLoading && (
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xl flex flex-col items-center justify-center p-10 animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 p-10 rounded-[3.5rem] shadow-2xl flex flex-col items-center text-center space-y-8 max-w-sm border border-white/10">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-30 animate-pulse"></div>
                            <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-[2rem] flex items-center justify-center text-white relative z-10 animate-bounce shadow-2xl">
                                <Sparkles size={48} />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-2xl font-black text-black dark:text-white tracking-tighter">Zeka Hazırlanıyor...</h3>
                            <p className="text-sm text-zinc-500 font-medium leading-relaxed">Yapay zeka senin için mükemmel kelime kartlarını (ve Türkçe anlamlarını) tasarlıyor.</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                    </div>
                </div>
            )}

            <header className="pt-4 mb-4 flex justify-between items-start">
                <div>
                    <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-1">Keşfet</h2>
                    <p className="text-zinc-500 font-medium text-sm italic">Dünyayı İngilizce ile tanı.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isGlobalLoading}
                        className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm text-indigo-500 active:scale-90 transition-all disabled:opacity-50"
                    >
                        <Camera size={20} />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                </div>
            </header>

            {/* Magic Search Bar Section */}
            <div className="space-y-3 mb-4">
                <div className="relative group">
                    <input 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && filteredLocalWords.length === 0 && handleQuickCreate()}
                        disabled={isGlobalLoading}
                        placeholder="Kelime ara veya AI ile oluştur..."
                        className="w-full bg-white dark:bg-zinc-900 p-4 pl-12 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-black dark:text-white disabled:opacity-50"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                        {isQuickCreating ? <Loader2 size={20} className="animate-spin text-indigo-500" /> : <Search size={20} />}
                    </div>
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute right-5 top-1/2 -translate-y-1/2 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Search Results */}
                {searchTerm.trim() && (
                    <div className="animate-slide-up space-y-2">
                        {filteredLocalWords.map(w => (
                            <div key={w.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center shadow-sm">
                                <div>
                                    <p className="font-black text-sm text-black dark:text-white">{w.term}</p>
                                    <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">{w.translation}</p>
                                </div>
                                <div className="px-2 py-0.5 bg-zinc-50 dark:bg-zinc-800 rounded-md text-[9px] font-black text-zinc-400 border border-zinc-100 dark:border-zinc-700">Koleksiyonda</div>
                            </div>
                        ))}
                        
                        {filteredLocalWords.length === 0 && !isQuickCreating && (
                            <button 
                                onClick={handleQuickCreate}
                                className="w-full bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 flex items-center justify-between group active:scale-[0.98] transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><Sparkles size={16} /></div>
                                    <div className="text-left">
                                        <p className="font-black text-xs text-indigo-700 dark:text-indigo-300 uppercase tracking-widest">Magic Create</p>
                                        <p className="text-[10px] text-indigo-600/60 font-medium">"{searchTerm}" kelimesini AI ile öğren</p>
                                    </div>
                                </div>
                                <ArrowRight size={16} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Daily Batch Prompt */}
            {needsDailyBatch && (
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-slide-up mb-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Zap size={80} /></div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600"><Zap size={20} /></div>
                        <div>
                            <h4 className="font-black text-sm">Günün Seti Hazır</h4>
                            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{userProfile?.goal} • {userProfile?.level}</p>
                        </div>
                    </div>
                    <p className="text-xs text-zinc-500 mb-4 font-medium relative z-10">Kişiselleştirilmiş algoritma ile senin için seçilen 10 kelimeyi hemen keşfet.</p>
                    <button 
                        onClick={onGenerateDaily}
                        disabled={isGlobalLoading}
                        className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                    >
                        {isGeneratingDaily ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} />}
                        {isGeneratingDaily ? 'Hazırlanıyor...' : 'Seti Aç'}
                    </button>
                </div>
            )}

            {/* Themed Explorer Section - REDESIGNED */}
            <div className="mb-4">
                <div className="flex justify-between items-center px-2 mb-3">
                    <h4 className="font-black text-[10px] uppercase tracking-widest text-zinc-400">Tematik Keşif</h4>
                    {isGeneratingTheme && <Loader2 size={14} className="animate-spin text-indigo-500" />}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    {DISCOVERY_THEMES.map(theme => {
                        const Icon = theme.icon;
                        return (
                            <button 
                                key={theme.id}
                                onClick={() => handleThemeDiscovery(theme.prompt)}
                                disabled={isGlobalLoading}
                                className={`relative group overflow-hidden rounded-[2.5rem] p-5 text-left shadow-lg transition-all active:scale-95 hover:shadow-xl disabled:opacity-50 disabled:active:scale-100 bg-gradient-to-br ${theme.gradient} ${theme.shadow}`}
                            >
                                {/* Background Abstract Icon */}
                                <Icon 
                                    size={80} 
                                    className="absolute -right-4 -bottom-4 text-white opacity-10 group-hover:opacity-20 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-500" 
                                />
                                
                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white mb-3 shadow-inner border border-white/20">
                                        <Icon size={20} />
                                    </div>
                                    <div className="mt-auto">
                                        <h3 className="text-base font-black text-white leading-tight mb-0.5">{theme.label}</h3>
                                        <p className="text-[8px] font-bold text-white/70 uppercase tracking-widest">{theme.subLabel}</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Discovered Words Results */}
            <div className="space-y-6">
                {discoveredWords.length > 0 ? (
                    <div className="animate-slide-up space-y-4">
                        <div className="flex justify-between items-center px-2">
                            <h4 className="font-black text-[10px] uppercase tracking-widest text-zinc-400">Yeni Keşfedilenler</h4>
                            <button onClick={() => setDiscoveredWords([])} className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Temizle</button>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {discoveredWords.map(word => (
                                <button 
                                    key={word.id} 
                                    onClick={() => setPreviewWord(word)}
                                    className="w-full bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center justify-between group animate-fade-in relative overflow-hidden text-left"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity"><Brain size={60} /></div>
                                    <div className="flex-1 min-w-0 pr-4 relative z-10">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h5 className="font-black text-xl text-black dark:text-white truncate">{word.term}</h5>
                                            <span className="text-[8px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">{word.type}</span>
                                        </div>
                                        <p className="text-sm text-indigo-600 dark:text-indigo-400 font-bold truncate mb-1">{word.translation}</p>
                                        <p className="text-[10px] text-zinc-400 font-medium line-clamp-1 italic">{word.definition}</p>
                                    </div>
                                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 rounded-2xl group-hover:text-indigo-600 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-all">
                                        <Info size={18} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : !needsDailyBatch && (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                        <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6">
                            <Brain size={32} />
                        </div>
                        <h3 className="font-bold text-lg mb-2">Başka Ne Öğrenelim?</h3>
                        <p className="text-xs max-w-[220px] mx-auto leading-relaxed">Yeni bir kelime aratarak, fotoğraf tarayarak veya temalara dokunarak keşfe başla.</p>
                    </div>
                )}
            </div>

            {/* Word Preview Modal (Hızlı Bakış & Öğrenme) */}
            {previewWord && (
                <div className="fixed inset-0 z-[120] flex items-end justify-center animate-fade-in bg-black/70 backdrop-blur-md px-4">
                    <div className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-t-[3.5rem] animate-slide-up shadow-2xl flex flex-col p-8 pb-12 max-h-[85dvh] border-t border-white/10 relative">
                        <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-6"></div>
                        
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-full">
                                <Sparkles size={16} className="text-indigo-500" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Yapay Zeka Keşfi</span>
                            </div>
                            <button onClick={() => setPreviewWord(null)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-10">
                            <div className="text-center">
                                <h3 className="text-5xl font-black text-black dark:text-white mb-2 tracking-tighter leading-tight break-all">{previewWord.term}</h3>
                                <div className="flex items-center justify-center gap-2 mb-6">
                                    <Languages size={20} className="text-indigo-500" />
                                    <div className="text-3xl font-black text-indigo-600 drop-shadow-sm">{previewWord.translation}</div>
                                </div>
                                <div className="flex flex-col items-center gap-3">
                                    <button 
                                        onClick={() => handleSpeak(previewWord.term)}
                                        disabled={isSpeaking}
                                        className="w-16 h-16 rounded-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center text-indigo-600 mx-auto shadow-md active:scale-90 transition-all disabled:opacity-50"
                                    >
                                        {isSpeaking ? <Loader2 className="animate-spin" size={28} /> : <Volume2 size={28} />}
                                    </button>
                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Sesi Dinle</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 relative overflow-hidden group">
                                    <div className="flex items-center gap-2 mb-3 text-zinc-400">
                                        <BookOpen size={16} />
                                        <p className="text-[10px] font-black uppercase tracking-widest">İngilizce Tanım</p>
                                    </div>
                                    <p className="text-sm font-medium leading-relaxed text-zinc-800 dark:text-zinc-200">
                                        {previewWord.definition}
                                    </p>
                                </div>

                                <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2 mb-3 text-zinc-400">
                                        <Lightbulb size={16} />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Örnek Cümle</p>
                                    </div>
                                    <p className="text-sm font-serif italic leading-relaxed text-zinc-700 dark:text-zinc-300">
                                        "{previewWord.exampleSentence}"
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 flex gap-3">
                            <button 
                                onClick={() => setPreviewWord(null)}
                                className="flex-1 py-5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-black rounded-3xl text-xs uppercase tracking-widest"
                            >
                                Geç
                            </button>
                            <button 
                                onClick={() => handleAddDiscoveredWord(previewWord)}
                                className="flex-[2.5] py-5 bg-indigo-600 text-white font-black rounded-3xl text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                                <Plus size={18} /> Koleksiyonuma Ekle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
