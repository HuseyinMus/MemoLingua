
import React, { useState } from 'react';
import { ArrowLeft, Search, Trophy, Sparkles, Filter, LayoutGrid, List, X, Volume2, Image as ImageIcon, BookOpen, ExternalLink, Loader2, Brain } from 'lucide-react';
import { UserWord, UserLevel } from '../types';
import { getWordDeepDive } from '../services/geminiService';
import { Shimmer } from './Shimmer';

interface CollectionProps {
    words: UserWord[];
    userLevel: UserLevel;
    onBack: () => void;
    loading?: boolean;
}

export const Collection: React.FC<CollectionProps> = ({ words, userLevel, onBack, loading = false }) => {
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list'); // Varsayılanı liste yaptık
    const [selectedWord, setSelectedWord] = useState<UserWord | null>(null);
    const [isFetchingDeepDive, setIsFetchingDeepDive] = useState(false);

    const filteredWords = words.filter(w => 
        w.term.toLowerCase().includes(search.toLowerCase()) || 
        w.translation.toLowerCase().includes(search.toLowerCase())
    );

    const masteredCount = words.filter(w => w.srs.interval >= 21).length;

    const handleWordClick = async (word: UserWord) => {
        setSelectedWord(word);
        if (!word.mnemonic || !word.visualScene) {
            setIsFetchingDeepDive(true);
            try {
                const deepDive = await getWordDeepDive(word.term, userLevel);
                setSelectedWord(prev => prev ? { ...prev, ...deepDive } : null);
            } catch (e) {} finally { setIsFetchingDeepDive(false); }
        }
    };

    const getSRSStatus = (word: UserWord) => {
        if (word.srs.interval >= 21) return { label: 'Ustalaşılmış', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
        if (word.srs.streak > 0) return { label: 'Öğreniliyor', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
        return { label: 'Yeni', color: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' };
    };

    return (
        <div className="h-full w-full bg-zinc-50 dark:bg-zinc-950 flex flex-col p-6 animate-fade-in relative overflow-hidden">
            <header className="pt-8 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white"><ArrowLeft /></button>
                    <div className="flex items-center gap-2 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-[10px] font-black shadow-sm uppercase tracking-widest">
                        <Trophy size={12} /> {masteredCount} Tam Öğrenilen
                    </div>
                </div>
                <h2 className="text-4xl font-black text-black dark:text-white tracking-tighter mb-2">Koleksiyon</h2>
                <p className="text-zinc-500 font-medium">Öğrendiğin tüm kelimeler ve ilerlemen.</p>
            </header>

            <div className="flex gap-3 mb-6">
                <div className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl flex items-center px-4 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                    <Search size={18} className="text-zinc-400 mr-2" />
                    <input 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Kelime ara..."
                        className="bg-transparent border-none outline-none py-3 text-sm font-bold w-full text-black dark:text-white"
                        disabled={loading}
                    />
                </div>
                <button 
                    onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
                    className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm text-black dark:text-white"
                >
                    {viewMode === 'grid' ? <List size={20} /> : <LayoutGrid size={20} />}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide pb-28">
                {loading ? (
                    // LOADING STATE SKELETON
                    <div className={`gap-3 ${viewMode === 'grid' ? 'grid grid-cols-2' : 'space-y-2'}`}>
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className={`bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 ${viewMode === 'list' ? 'flex items-center gap-4' : 'h-32'}`}>
                                <div className="flex-1 space-y-3">
                                    <Shimmer className="h-4 w-3/4" />
                                    <Shimmer className="h-3 w-1/2" />
                                </div>
                                {viewMode === 'list' && <Shimmer className="h-8 w-8 rounded-full" />}
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 gap-3">
                                {filteredWords.map(word => {
                                    const isMastered = word.srs.interval >= 21;
                                    return (
                                        <button 
                                            key={word.id} 
                                            onClick={() => handleWordClick(word)}
                                            className={`p-5 rounded-[2rem] border text-left relative overflow-hidden transition-all active:scale-95 ${isMastered ? 'bg-indigo-600 text-white border-transparent shadow-xl' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-black dark:text-white shadow-sm'}`}
                                        >
                                            {isMastered && <Sparkles size={40} className="absolute -right-4 -bottom-4 opacity-20" />}
                                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-3 inline-block ${isMastered ? 'bg-white/20' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                                                {word.type}
                                            </span>
                                            <h3 className="text-xl font-black truncate mb-0.5">{word.term}</h3>
                                            <p className={`text-xs font-medium truncate ${isMastered ? 'text-white/80' : 'text-zinc-500'}`}>{word.translation}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredWords.map(word => {
                                    const status = getSRSStatus(word);
                                    return (
                                        <button 
                                            key={word.id} 
                                            onClick={() => handleWordClick(word)} 
                                            className="w-full bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all group"
                                        >
                                            <div className="text-left flex-1 min-w-0 pr-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-black text-lg text-black dark:text-white truncate">{word.term}</h3>
                                                    <span className="text-[10px] text-zinc-400 font-bold uppercase">{word.type}</span>
                                                </div>
                                                <p className="text-sm text-zinc-500 font-medium truncate">{word.translation}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${status.color}`}>
                                                    {status.label}
                                                </div>
                                                <div className="flex gap-0.5">
                                                    {[...Array(5)].map((_, i) => (
                                                        <div 
                                                            key={i} 
                                                            className={`w-1.5 h-1.5 rounded-full ${i < (word.srs.streak % 6) ? 'bg-indigo-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        
                        {filteredWords.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center text-zinc-300 mb-4">
                                    <Search size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-black dark:text-white">Kelime bulunamadı</h3>
                                <p className="text-sm text-zinc-500">Arama kriterlerini değiştirmeyi dene.</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Word Detail Modal */}
            {selectedWord && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center animate-fade-in p-0 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-t-[3rem] animate-slide-up shadow-2xl flex flex-col max-h-[90dvh]">
                        <div className="p-8 pb-4 flex justify-between items-center">
                            <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-900 rounded-full text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sözlük Kartı</span>
                            <button onClick={() => setSelectedWord(null)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full"><X size={20}/></button>
                        </div>
                        
                        <div className="px-8 pb-12 overflow-y-auto scrollbar-hide">
                            <div className="mb-10 text-center">
                                <h3 className="text-5xl font-black text-black dark:text-white mb-2 tracking-tighter">{selectedWord.term}</h3>
                                <p className="text-2xl font-bold text-zinc-500">{selectedWord.translation}</p>
                            </div>

                            <div className="space-y-6">
                                <section>
                                    <div className="flex items-center gap-2 mb-3 text-blue-600">
                                        <BookOpen size={18} />
                                        <h4 className="font-bold text-sm">Tanım</h4>
                                    </div>
                                    <div className="bg-zinc-50 dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                                        <p className="text-sm italic leading-relaxed text-zinc-700 dark:text-zinc-300">"{selectedWord.definition}"</p>
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center gap-2 mb-3 text-purple-600">
                                        <Sparkles size={18} />
                                        <h4 className="font-bold text-sm">Hafıza Kartı (Mnemonic)</h4>
                                    </div>
                                    <div className="bg-purple-50 dark:bg-purple-900/20 p-5 rounded-3xl border border-purple-100 dark:border-purple-800">
                                        {isFetchingDeepDive ? <Loader2 className="animate-spin text-purple-400 mx-auto" /> : (
                                            <p className="text-sm font-medium text-purple-900 dark:text-purple-200">{selectedWord.mnemonic || "Üretiliyor..."}</p>
                                        )}
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center gap-2 mb-3 text-orange-600">
                                        <Brain size={18} />
                                        <h4 className="font-bold text-sm">Görsel Sahne</h4>
                                    </div>
                                    <div className="bg-orange-50 dark:bg-orange-900/20 p-5 rounded-3xl border border-orange-100 dark:border-orange-800">
                                        {isFetchingDeepDive ? <Loader2 className="animate-spin text-orange-400 mx-auto" /> : (
                                            <p className="text-sm italic text-orange-900 dark:text-orange-200 font-medium">"{selectedWord.visualScene || "Sahne hazırlanıyor..."}"</p>
                                        )}
                                    </div>
                                </section>

                                <section className="pb-8">
                                    <div className="flex items-center gap-2 mb-3 text-zinc-500">
                                        <ExternalLink size={18} />
                                        <h4 className="font-bold text-sm">Kelime Kökeni</h4>
                                    </div>
                                    <p className="text-xs text-zinc-400 leading-relaxed px-1">{selectedWord.origin || "Köken bilgisi yükleniyor..."}</p>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
