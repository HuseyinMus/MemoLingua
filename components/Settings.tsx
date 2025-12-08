
import React, { useState } from 'react';
import { ArrowLeft, Sun, Moon, Settings as SettingsIcon, Volume2, Bell, Trash2, LogOut, Download, FileJson, X, Edit2 } from 'lucide-react';
import { UserProfile, AppTheme, UserWord } from '../types';

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
          // Safe JSON Stringify logic for export
          const safeStringify = (obj: any) => {
              const cache = new Set();
              return JSON.stringify(obj, (key, value) => {
                  if (typeof value === 'object' && value !== null) {
                      if (cache.has(value)) {
                          return; // Circular ref found
                      }
                      cache.add(value);
                  }
                  return value;
              }, 2);
          };

          const safeProfile = userProfile ? JSON.parse(safeStringify(userProfile)) : null;
          const safeWords = words ? JSON.parse(safeStringify(words)) : [];
          
          const data = {
              profile: safeProfile,
              words: safeWords,
              exportDate: new Date().toISOString(),
              appVersion: '1.1.0'
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
    <div className="p-6 h-full flex flex-col pt-8 animate-fade-in max-w-md mx-auto relative">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
             <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-black dark:text-white transition-colors">
                 <ArrowLeft size={24} />
             </button>
            <div>
                <h2 className="text-3xl font-bold text-black dark:text-white tracking-tight">Ayarlar</h2>
                <p className="text-zinc-500 font-medium">Tercihler & Hesap</p>
            </div>
        </div>

        <div className="space-y-6 flex-1 overflow-y-auto scrollbar-hide">
            
            {/* Profile Section */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                <div className="relative">
                    <button 
                        onClick={() => setShowAvatarSelector(true)}
                        className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-4xl shadow-inner hover:scale-105 transition-transform border border-zinc-200 dark:border-zinc-700"
                    >
                        {userProfile?.avatar || '🎓'}
                    </button>
                    <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-1.5 border-2 border-white dark:border-zinc-900 cursor-pointer pointer-events-none">
                        <Edit2 size={10} className="text-white" />
                    </div>
                </div>
                <div>
                    <h3 className="font-bold text-lg text-black dark:text-white">{userProfile?.username || 'User'}</h3>
                    <p className="text-zinc-500 text-sm font-medium capitalize">{userProfile?.level} • {userProfile?.league} Ligi</p>
                    <button 
                        onClick={() => setShowAvatarSelector(true)}
                        className="text-blue-600 dark:text-blue-400 text-xs font-bold mt-1"
                    >
                        Avatarı Değiştir
                    </button>
                </div>
            </div>

            {/* Avatar Selector Modal */}
            {showAvatarSelector && (
                <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] shadow-2xl p-6 border border-zinc-100 dark:border-zinc-800 animate-slide-up">
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
                                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:scale-110 transition-all ${userProfile?.avatar === emoji ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500' : ''}`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Appearance */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Görünüm</h3>
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

            {/* Preferences */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Tercihler</h3>
                
                {/* Sound Effects */}
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

                {/* Notifications */}
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
            </div>

            {/* Account & Data */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Veri & Gizlilik</h3>
                
                <button 
                    onClick={handleExportData}
                    className="w-full text-left flex items-center gap-3 py-2 text-zinc-800 dark:text-zinc-200 hover:text-black dark:hover:text-white transition-colors"
                >
                    <Download size={18} />
                    <span className="font-bold text-sm">Verileri İndir (JSON)</span>
                </button>
                
                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2"></div>

                <button 
                    onClick={() => {
                        if(confirm('Tüm verileri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
                            onClearData();
                        }
                    }}
                    className="w-full text-left flex items-center gap-3 py-2 text-red-500 hover:opacity-75 transition-opacity"
                >
                    <Trash2 size={18} />
                    <span className="font-bold text-sm">Verileri Temizle</span>
                </button>
                <button 
                    onClick={onSignOut}
                    className="w-full text-left flex items-center gap-3 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                    <LogOut size={18} />
                    <span className="font-bold text-sm">Çıkış Yap</span>
                </button>
            </div>

            <div className="text-center text-xs text-zinc-400 py-4">
                MemoLingua v1.1.0 • Built with Gemini AI
            </div>
        </div>
    </div>
  );
};
