
import React, { useState } from 'react';
import { ArrowLeft, Sun, Moon, Settings as SettingsIcon, Volume2, Bell, Trash2, LogOut, Download, X, Edit2, Target, Clock, GraduationCap, Globe } from 'lucide-react';
import { UserProfile, AppTheme, UserWord, UserLevel, UserGoal } from '../types';

interface SettingsProps {
  userProfile: UserProfile | null;
  words: UserWord[];
  onUpdateProfile: (key: keyof UserProfile, value: any) => void;
  onBack: () => void;
  onClearData: () => void;
  onSignOut: () => void;
}

const AVATARS = [
    '👨‍🎓', '👩‍🎓', '🦁', '🚀', '🎨', '👑', '🐼', '🦊', '🐼', '💀', 
    '🔥', '⚡', '🦉', '🦋', '⚽', '🏀', '🎮', '🎧', '🎸', '📷'
];

const LEVELS: UserLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const GOALS: UserGoal[] = ['General English', 'IELTS', 'TOEFL', 'SAT', 'Business', 'Travel'];
const TARGETS = [5, 10, 15, 20, 30];

export const Settings: React.FC<SettingsProps> = ({ 
  userProfile, 
  words,
  onUpdateProfile, 
  onBack,
  onClearData,
  onSignOut 
}) => {
  const settings = userProfile?.settings || { autoPlayAudio: true, notifications: true, soundEffects: true };
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);

  const handleThemeChange = (theme: AppTheme) => {
    onUpdateProfile('theme', theme);
  };

  const toggleSetting = (key: keyof typeof settings) => {
    onUpdateProfile('settings', { ...settings, [key]: !settings[key] });
  };

  const handleExportData = () => {
      try {
          const exportData = {
              profile: userProfile,
              words: words,
              exportDate: new Date().toISOString(),
              version: "1.2.5"
          };
          
          const jsonString = JSON.stringify(exportData, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href", url);
          downloadAnchorNode.setAttribute("download", `memolingua_local_backup.json`);
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
          URL.revokeObjectURL(url);
      } catch (error) {
          console.error("Export failed:", error);
          alert("Yedek alınırken hata oluştu.");
      }
  };

  return (
    <div className="p-6 h-full flex flex-col pt-8 animate-fade-in max-w-md mx-auto relative bg-zinc-50 dark:bg-zinc-950">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4 shrink-0">
             <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-black dark:text-white transition-colors">
                 <ArrowLeft size={24} />
             </button>
            <div>
                <h2 className="text-3xl font-bold text-black dark:text-white tracking-tight">Ayarlar</h2>
                <p className="text-zinc-500 font-medium text-sm">Uygulama Deneyimini Yönet</p>
            </div>
        </div>

        <div className="space-y-6 flex-1 overflow-y-auto scrollbar-hide pb-20">
            
            {/* Identity Section */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-6">
                <div className="relative">
                    <button 
                        onClick={() => setShowAvatarSelector(true)}
                        className="w-24 h-24 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-5xl shadow-inner hover:scale-105 transition-transform border border-zinc-200 dark:border-zinc-700"
                    >
                        {userProfile?.avatar || '🎓'}
                    </button>
                    <div className="absolute -bottom-1 -right-1 bg-indigo-600 rounded-full p-2.5 border-4 border-white dark:border-zinc-900 cursor-pointer pointer-events-none">
                        <Edit2 size={14} className="text-white" />
                    </div>
                </div>
                <div className="flex-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2 ml-1">Kullanıcı Adı</label>
                    <input 
                        type="text" 
                        value={userProfile?.username || ''} 
                        onChange={(e) => onUpdateProfile('username', e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-black dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                </div>
            </div>

            {/* Learning Goals */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Öğrenim Hedefleri</h3>
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-8">
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-purple-600 dark:text-purple-400">
                            <GraduationCap size={20} />
                            <span className="font-black text-sm uppercase tracking-tighter">İngilizce Seviyesi</span>
                        </div>
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl overflow-x-auto scrollbar-hide">
                            {LEVELS.map(lvl => (
                                <button
                                    key={lvl}
                                    onClick={() => onUpdateProfile('level', lvl)}
                                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all whitespace-nowrap ${userProfile?.level === lvl ? 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-md' : 'text-zinc-500 dark:text-zinc-400'}`}
                                >
                                    {lvl}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Preferences Toggles */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Tercihler</h3>
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 shadow-sm"><Volume2 size={20} /></div>
                            <span className="font-black text-sm text-black dark:text-white tracking-tight">Ses Efektleri</span>
                        </div>
                        <button onClick={() => toggleSetting('soundEffects')} className={`w-14 h-8 rounded-full p-1.5 transition-colors ${settings.soundEffects ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}><div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.soundEffects ? 'translate-x-6' : ''}`}></div></button>
                    </div>
                </div>
            </div>

            {/* Data Management */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Veri Yönetimi</h3>
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
                    <button onClick={handleExportData} className="w-full text-left flex items-center gap-4 py-4 px-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center"><Download size={20} /></div>
                        <div className="flex-1"><span className="font-black text-sm block">Yedekle (JSON)</span><span className="text-[10px] text-zinc-400 font-bold uppercase">Cihazına indir</span></div>
                    </button>
                    
                    <button onClick={() => { if(confirm('Tüm verileri silmek istediğinize emin misiniz?')) onClearData(); }} className="w-full text-left flex items-center gap-4 py-4 px-3 rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-all">
                        <div className="w-10 h-10 bg-red-50 dark:bg-red-900/10 rounded-xl flex items-center justify-center"><Trash2 size={20} /></div>
                        <div className="flex-1"><span className="font-black text-sm block">Tüm Verileri Sıfırla</span><span className="text-[10px] opacity-60 font-bold uppercase">Geri alınamaz</span></div>
                    </button>
                </div>
            </div>

            <div className="text-center text-[10px] font-black uppercase tracking-widest text-zinc-400 py-10 opacity-60">
                MemoLingua v1.2.5 • AI Engine Build 9021
            </div>
        </div>

        {/* Avatar Selector Modal */}
        {showAvatarSelector && (
            <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[3rem] shadow-2xl p-8 border border-zinc-100 dark:border-zinc-800 animate-slide-up">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-black text-black dark:text-white tracking-tight">Profil Seç</h3>
                        <button onClick={() => setShowAvatarSelector(false)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full"><X size={24} /></button>
                    </div>
                    <div className="grid grid-cols-5 gap-4">
                        {AVATARS.map(emoji => (
                            <button key={emoji} onClick={() => { onUpdateProfile('avatar', emoji); setShowAvatarSelector(false); }} className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-all ${userProfile?.avatar === emoji ? 'bg-indigo-100 border-2 border-indigo-500' : 'bg-zinc-50'}`}>{emoji}</button>
                        ))}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
