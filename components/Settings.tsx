
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
    '👨‍🎓', '👩‍🎓', '🦁', '🚀', '🎨', '👑', '🐼', '🦊', '🤖', '💀', 
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
          const deepSanitize = (obj: any, seen = new WeakSet()): any => {
                if (obj === null || typeof obj !== 'object') return obj;
                if (seen.has(obj)) return null;
                seen.add(obj);
                if (Array.isArray(obj)) return obj.map(i => deepSanitize(i, seen));
                const res: any = {};
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                         if (key.startsWith('_') || key === 'delegate') continue;
                         res[key] = deepSanitize(obj[key], seen);
                    }
                }
                return res;
          };

          const safeProfile = userProfile ? deepSanitize(userProfile) : null;
          const safeWords = words ? deepSanitize(words) : [];
          
          const data = {
              profile: safeProfile,
              words: safeWords,
              exportDate: new Date().toISOString(),
              appVersion: '1.2.0'
          };
          
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href", dataStr);
          downloadAnchorNode.setAttribute("download", `memolingua_backup_${new Date().toISOString().split('T')[0]}.json`);
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
      } catch (error) {
          console.error("Export failed:", error);
          alert("Veri dışa aktarılırken bir hata oluştu.");
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
                <p className="text-zinc-500 font-medium">Profilini Düzenle</p>
            </div>
        </div>

        <div className="space-y-6 flex-1 overflow-y-auto scrollbar-hide pb-20">
            
            {/* Identity Section */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                <div className="relative">
                    <button 
                        onClick={() => setShowAvatarSelector(true)}
                        className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-5xl shadow-inner hover:scale-105 transition-transform border border-zinc-200 dark:border-zinc-700"
                    >
                        {userProfile?.avatar || '🎓'}
                    </button>
                    <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-2 border-2 border-white dark:border-zinc-900 cursor-pointer pointer-events-none">
                        <Edit2 size={12} className="text-white" />
                    </div>
                </div>
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Kullanıcı Adı</label>
                    <input 
                        type="text" 
                        value={userProfile?.username || ''} 
                        onChange={(e) => onUpdateProfile('username', e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-black dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Avatar Selector Modal */}
            {showAvatarSelector && (
                <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-6 border border-zinc-100 dark:border-zinc-800 animate-slide-up">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-black dark:text-white">Avatar Seç</h3>
                            <button onClick={() => setShowAvatarSelector(false)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                <X size={20} className="text-black dark:text-white"/>
                            </button>
                        </div>
                        <div className="grid grid-cols-5 gap-3">
                            {AVATARS.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => {
                                        onUpdateProfile('avatar', emoji);
                                        setShowAvatarSelector(false);
                                    }}
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:scale-110 transition-all ${userProfile?.avatar === emoji ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500' : ''}`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Learning Goals */}
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-2">Öğrenim Hedefleri</h3>
                
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                    {/* Level */}
                    <div>
                        <div className="flex items-center gap-2 mb-3 text-purple-600 dark:text-purple-400">
                            <GraduationCap size={18} />
                            <span className="font-bold text-sm">İngilizce Seviyesi</span>
                        </div>
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl overflow-x-auto">
                            {LEVELS.map(lvl => (
                                <button
                                    key={lvl}
                                    onClick={() => onUpdateProfile('level', lvl)}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${userProfile?.level === lvl ? 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'}`}
                                >
                                    {lvl}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Goal */}
                    <div>
                        <div className="flex items-center gap-2 mb-3 text-blue-600 dark:text-blue-400">
                            <Globe size={18} />
                            <span className="font-bold text-sm">Odak Noktası</span>
                        </div>
                        <select 
                            value={userProfile?.goal} 
                            onChange={(e) => onUpdateProfile('goal', e.target.value)}
                            className="w-full bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white font-bold text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                        >
                            {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>

                    {/* Daily Target */}
                    <div>
                        <div className="flex items-center gap-2 mb-3 text-green-600 dark:text-green-400">
                            <Target size={18} />
                            <span className="font-bold text-sm">Günlük Kelime Hedefi</span>
                        </div>
                        <div className="flex justify-between gap-2">
                            {TARGETS.map(t => (
                                <button
                                    key={t}
                                    onClick={() => onUpdateProfile('dailyTarget', t)}
                                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                                        userProfile?.dailyTarget === t 
                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
                                            : 'border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                     {/* Study Time */}
                     <div>
                        <div className="flex items-center gap-2 mb-3 text-orange-600 dark:text-orange-400">
                            <Clock size={18} />
                            <span className="font-bold text-sm">Çalışma Saati (Bildirim)</span>
                        </div>
                        <input 
                            type="time" 
                            value={userProfile?.studyTime}
                            onChange={(e) => onUpdateProfile('studyTime', e.target.value)}
                            className="w-full bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </div>
                </div>
            </div>

            {/* App Settings */}
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-2">Uygulama</h3>
                
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                    {/* Appearance */}
                    <div>
                         <span className="font-bold text-sm text-black dark:text-white block mb-3">Tema</span>
                         <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                            {(['light', 'dark', 'system'] as const).map(theme => (
                                <button
                                    key={theme}
                                    onClick={() => handleThemeChange(theme)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all flex items-center justify-center gap-2 ${userProfile?.theme === theme ? 'bg-white dark:bg-zinc-600 text-black dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}
                                >
                                    {theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <SettingsIcon size={14} />}
                                    {theme === 'light' ? 'Açık' : theme === 'dark' ? 'Koyu' : 'Sistem'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preferences Toggles */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <Volume2 size={16} />
                                </div>
                                <span className="font-bold text-sm text-black dark:text-white">Ses Efektleri</span>
                            </div>
                            <button 
                                onClick={() => toggleSetting('soundEffects')}
                                className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors ${settings.soundEffects ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.soundEffects ? 'translate-x-5' : ''}`}></div>
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                    <Bell size={16} />
                                </div>
                                <span className="font-bold text-sm text-black dark:text-white">Bildirimler</span>
                            </div>
                            <button 
                                onClick={() => toggleSetting('notifications')}
                                className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors ${settings.notifications ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.notifications ? 'translate-x-5' : ''}`}></div>
                            </button>
                        </div>
                        
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                                    <Volume2 size={16} />
                                </div>
                                <span className="font-bold text-sm text-black dark:text-white">Otomatik Seslendirme</span>
                            </div>
                            <button 
                                onClick={() => toggleSetting('autoPlayAudio')}
                                className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors ${settings.autoPlayAudio ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.autoPlayAudio ? 'translate-x-5' : ''}`}></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Account & Data */}
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-2">Veri & Gizlilik</h3>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
                    <button 
                        onClick={handleExportData}
                        className="w-full text-left flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors"
                    >
                        <Download size={18} />
                        <span className="font-bold text-sm">Verileri İndir (JSON)</span>
                    </button>
                    
                    <button 
                        onClick={() => {
                            if(confirm('Tüm verileri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
                                onClearData();
                            }
                        }}
                        className="w-full text-left flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                    >
                        <Trash2 size={18} />
                        <span className="font-bold text-sm">Verileri Temizle</span>
                    </button>
                    <button 
                        onClick={onSignOut}
                        className="w-full text-left flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                        <LogOut size={18} />
                        <span className="font-bold text-sm">Çıkış Yap</span>
                    </button>
                </div>
            </div>

            <div className="text-center text-xs text-zinc-400 py-4">
                MemoLingua v1.2.0 • AI-Powered Learning
            </div>
        </div>
    </div>
  );
};
