import React from 'react';
import { ArrowLeft, Sun, Moon, Settings as SettingsIcon, Volume2, Bell, Trash2, LogOut, Download, FileJson } from 'lucide-react';
import { UserProfile, AppTheme, UserWord } from '../types';

interface SettingsProps {
  userProfile: UserProfile | null;
  words: UserWord[];
  onUpdateProfile: (key: keyof UserProfile, value: any) => void;
  onBack: () => void;
  onClearData: () => void;
  onSignOut: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  userProfile, 
  words,
  onUpdateProfile, 
  onBack,
  onClearData,
  onSignOut 
}) => {
  const settings = userProfile?.settings || { autoPlayAudio: true, notifications: true, soundEffects: true };

  const handleThemeChange = (theme: AppTheme) => {
    onUpdateProfile('theme', theme);
  };

  const toggleSetting = (key: keyof typeof settings) => {
    onUpdateProfile('settings', { ...settings, [key]: !settings[key] });
  };

  const handleExportData = () => {
      const data = {
          profile: userProfile,
          words: words,
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
  };

  return (
    <div className="p-6 h-full flex flex-col pt-8 animate-fade-in max-w-md mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
             <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-black dark:text-white transition-colors">
                 <ArrowLeft size={24} />
             </button>
            <div>
                <h2 className="text-3xl font-bold text-black dark:text-white tracking-tight">Settings</h2>
                <p className="text-zinc-500 font-medium">Preferences & Account</p>
            </div>
        </div>

        <div className="space-y-6 flex-1 overflow-y-auto scrollbar-hide">
            {/* Appearance */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Appearance</h3>
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                    {(['light', 'dark', 'system'] as const).map(theme => (
                        <button
                            key={theme}
                            onClick={() => handleThemeChange(theme)}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all flex items-center justify-center gap-2 ${userProfile?.theme === theme ? 'bg-white dark:bg-zinc-600 text-black dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}
                        >
                            {theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <SettingsIcon size={14} />}
                            {theme}
                        </button>
                    ))}
                </div>
            </div>

            {/* Preferences */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Preferences</h3>
                
                {/* Sound Effects */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Volume2 size={16} />
                        </div>
                        <span className="font-bold text-sm text-black dark:text-white">Sound Effects</span>
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
                        <span className="font-bold text-sm text-black dark:text-white">Notifications</span>
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
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Data & Privacy</h3>
                
                <button 
                    onClick={handleExportData}
                    className="w-full text-left flex items-center gap-3 py-2 text-zinc-800 dark:text-zinc-200 hover:text-black dark:hover:text-white transition-colors"
                >
                    <Download size={18} />
                    <span className="font-bold text-sm">Export Backup (JSON)</span>
                </button>
                
                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2"></div>

                <button 
                    onClick={() => {
                        if(confirm('Are you sure you want to delete all data? This cannot be undone.')) {
                            onClearData();
                        }
                    }}
                    className="w-full text-left flex items-center gap-3 py-2 text-red-500 hover:opacity-75 transition-opacity"
                >
                    <Trash2 size={18} />
                    <span className="font-bold text-sm">Clear All Data</span>
                </button>
                <button 
                    onClick={onSignOut}
                    className="w-full text-left flex items-center gap-3 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                    <LogOut size={18} />
                    <span className="font-bold text-sm">Sign Out</span>
                </button>
            </div>

            <div className="text-center text-xs text-zinc-400 py-4">
                MemoLingua v1.1.0 • Built with Gemini AI
            </div>
        </div>
    </div>
  );
};