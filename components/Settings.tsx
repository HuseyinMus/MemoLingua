
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
          // Extremely robust approach: explicitly convert everything to primitive types
          const cleanProfile = userProfile ? {
              username: String(userProfile.username || ''),
              avatar: String(userProfile.avatar || ''),
              level: String(userProfile.level || 'A1'),
              goal: String(userProfile.goal || 'General English'),
              xp: Number(userProfile.xp || 0),
              streak: Number(userProfile.streak || 0),
              longestStreak: Number(userProfile.longestStreak || 0),
              dailyTarget: Number(userProfile.dailyTarget || 10),
              studyTime: String(userProfile.studyTime || '09:00'),
              theme: String(userProfile.theme || 'system'),
              settings: {
                  autoPlayAudio: Boolean(userProfile.settings?.autoPlayAudio),
                  notifications: Boolean(userProfile.settings?.notifications),
                  soundEffects: Boolean(userProfile.settings?.soundEffects)
              }
          } : null;

          const cleanWords = Array.isArray(words) ? words.map(w => ({
              id: String(w.id),
              term: String(w.term),
              translation: String(w.translation),
              definition: String(w.definition),
              exampleSentence: String(w.exampleSentence),
              pronunciation: String(w.pronunciation),
              type: String(w.type),
              dateAdded: Number(w.dateAdded),
              srs: {
                  nextReview: Number(w.srs?.nextReview || Date.now()),
                  interval: Number(w.srs?.interval || 0),
                  easeFactor: Number(w.srs?.easeFactor || 2.5),
                  streak: Number(w.srs?.streak || 0)
              }
          })) : [];

          const exportData = {
              profile: cleanProfile,
              words: cleanWords,
              exportDate: new Date().toISOString(),
              version: "1.2.5"
          };
          
          const jsonString = JSON.stringify(exportData, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href", url);
          downloadAnchorNode.setAttribute("download", `memolingua_data_${new Date().toISOString().split('T')[0]}.json`);
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
          URL.revokeObjectURL(url);
      } catch (error) {
          console.error("Export failed:", error);
          alert("Veri dışa aktarılırken bir hata oluştu. Lütfen tekrar deneyin.");
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
                <p className="text-zinc-500 font-medium text-sm">Profilini ve Deneyimini Yönet</p>
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

            {/* Avatar Selector Modal */}
            {showAvatarSelector && (
                <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[3rem] shadow-2xl p-8 border border-zinc-100 dark:border-zinc-800 animate-slide-up">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-black dark:text-white tracking-tight">Yeni Profil Seç</h3>
                            <button onClick={() => setShowAvatarSelector(false)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                <X size={24} className="text-black dark:text-white"/>
                            </button>
                        </div>
                        <div className="grid grid-cols-5 gap-4">
                            {AVATARS.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => {
                                        onUpdateProfile('avatar', emoji);
                                        setShowAvatarSelector(false);
                                    }}
                                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:scale-110 transition-all ${userProfile?.avatar === emoji ? 'bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-500 shadow-md' : 'bg-zinc-50 dark:bg-zinc-800/50'}`}
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
                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Öğrenim Yolculuğu</h3>
                
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-8">
                    {/* Level */}
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

                    {/* Goal */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-indigo-600 dark:text-indigo-400">
                            <Globe size={20} />
                            <span className="font-black text-sm uppercase tracking-tighter">Ana Hedef</span>
                        </div>
                        <select 
                            value={userProfile?.goal} 
                            onChange={(e) => onUpdateProfile('goal', e.target.value)}
                            className="w-full bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white font-black text-sm rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none shadow-sm"
                        >
                            {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>

                    {/* Daily Target */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-green-600 dark:text-green-400">
                            <Target size={20} />
                            <span className="font-black text-sm uppercase tracking-tighter">Günlük Kelime Hedefi</span>
                        </div>
                        <div className="flex justify-between gap-2">
                            {TARGETS.map(t => (
                                <button
                                    key={t}
                                    onClick={() => onUpdateProfile('dailyTarget', t)}
                                    className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all border-2 ${
                                        userProfile?.dailyTarget === t 
                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 shadow-md' 
                                            : 'border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                     {/* Study Time */}
                     <div>
                        <div className="flex items-center gap-2 mb-4 text-orange-600 dark:text-orange-400">
                            <Clock size={20} />
                            <span className="font-black text-sm uppercase tracking-tighter">Hatırlatma Saati</span>
                        </div>
                        <input 
                            type="time" 
                            value={userProfile?.studyTime}
                            onChange={(e) => onUpdateProfile('studyTime', e.target.value)}
                            className="w-full bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white font-black rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-orange-500/10 shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* App Settings */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Deneyim Ayarları</h3>
                
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-8">
                    {/* Appearance */}
                    <div>
                         <span className="font-black text-sm text-black dark:text-white block mb-4 uppercase tracking-tighter">Görünüm</span>
                         <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl">
                            {(['light', 'dark', 'system'] as const).map(theme => (
                                <button
                                    key={theme}
                                    onClick={() => handleThemeChange(theme)}
                                    className={`flex-1 py-3 rounded-xl text-xs font-black capitalize transition-all flex items-center justify-center gap-2 ${userProfile?.theme === theme ? 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-md' : 'text-zinc-500 dark:text-zinc-400'}`}
                                >
                                    {theme === 'light' ? <Sun size={16} /> : theme === 'dark' ? <Moon size={16} /> : <SettingsIcon size={16} />}
                                    {theme === 'light' ? 'Açık' : theme === 'dark' ? 'Koyu' : 'Sistem'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preferences Toggles */}
                    <div className="space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                                    <Volume2 size={20} />
                                </div>
                                <span className="font-black text-sm text-black dark:text-white tracking-tight">Ses Efektleri</span>
                            </div>
                            <button 
                                onClick={() => toggleSetting('soundEffects')}
                                className={`w-14 h-8 rounded-full p-1.5 cursor-pointer transition-colors ${settings.soundEffects ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-lg transition-transform ${settings.soundEffects ? 'translate-x-6' : ''}`}></div>
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-sm">
                                    <Bell size={20} />
                                </div>
                                <span className="font-black text-sm text-black dark:text-white tracking-tight">Bildirimler</span>
                            </div>
                            <button 
                                onClick={() => toggleSetting('notifications')}
                                className={`w-14 h-8 rounded-full p-1.5 cursor-pointer transition-colors ${settings.notifications ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-lg transition-transform ${settings.notifications ? 'translate-x-6' : ''}`}></div>
                            </button>
                        </div>
                        
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 shadow-sm">
                                    <Volume2 size={20} />
                                </div>
                                <span className="font-black text-sm text-black dark:text-white tracking-tight">Otomatik Ses</span>
                            </div>
                            <button 
                                onClick={() => toggleSetting('autoPlayAudio')}
                                className={`w-14 h-8 rounded-full p-1.5 cursor-pointer transition-colors ${settings.autoPlayAudio ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-lg transition-transform ${settings.autoPlayAudio ? 'translate-x-6' : ''}`}></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Account & Data */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Veri ve Güvenlik</h3>
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
                    <button 
                        onClick={handleExportData}
                        className="w-full text-left flex items-center gap-4 py-4 px-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-all active:scale-[0.98]"
                    >
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center"><Download size={20} /></div>
                        <div className="flex-1">
                            <span className="font-black text-sm block">Verileri İndir (JSON)</span>
                            <span className="text-[10px] text-zinc-400 font-bold uppercase">Tüm ilerlemeni yedekle</span>
                        </div>
                    </button>
                    
                    <button 
                        onClick={() => {
                            if(confirm('Tüm verileri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
                                onClearData();
                            }
                        }}
                        className="w-full text-left flex items-center gap-4 py-4 px-3 rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-all active:scale-[0.98]"
                    >
                        <div className="w-10 h-10 bg-red-50 dark:bg-red-900/10 rounded-xl flex items-center justify-center"><Trash2 size={20} /></div>
                        <div className="flex-1">
                            <span className="font-black text-sm block">Tüm Verileri Sıfırla</span>
                            <span className="text-[10px] opacity-60 font-bold uppercase">Hesap silinmez, veriler temizlenir</span>
                        </div>
                    </button>
                    
                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2"></div>

                    <button 
                        onClick={onSignOut}
                        className="w-full text-left flex items-center gap-4 py-4 px-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all active:scale-[0.98]"
                    >
                        <div className="w-10 h-10 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center"><LogOut size={20} /></div>
                        <span className="font-black text-sm">Oturumu Kapat</span>
                    </button>
                </div>
            </div>

            <div className="text-center text-[10px] font-black uppercase tracking-widest text-zinc-400 py-10 opacity-60">
                MemoLingua v1.2.5 • AI Engine Build 9021
            </div>
        </div>
    </div>
  );
};
