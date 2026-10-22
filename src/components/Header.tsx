import React from 'react';
import { Bell, BellOff, Activity, Radar, Send } from 'lucide-react';

interface HeaderProps {
  activeTab: 'momentum' | 'radar';
  onTabChange: (tab: 'momentum' | 'radar') => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isConnected: boolean;
  onOpenNotifications?: () => void;
  notificationsEnabled?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  soundEnabled,
  onToggleSound,
  isConnected,
  onOpenNotifications,
  notificationsEnabled = false,
}) => {
  return (
    <>
      <header className="sticky top-0 z-50 bg-gray-900 border-b border-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-brand-blue to-purple-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="7" y1="3" x2="7" y2="19"></line>
                <rect x="4" y="7" width="6" height="8" rx="1" fill="currentColor" stroke="none"></rect>
                <line x1="17" y1="5" x2="17" y2="21"></line>
                <rect x="14" y="9" width="6" height="6" rx="1" fill="transparent"></rect>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-tight">Momentum</h1>
              <span className="text-[9px] text-brand-gold font-mono tracking-widest uppercase">
                AHMED SYSTEM AI
              </span>
            </div>
          </div>

          {/* Desktop Tabs */}
          <div className="hidden md:flex items-center gap-2 bg-gray-950 p-1 rounded-lg border border-gray-800">
            <button
              onClick={() => onTabChange('momentum')}
              className={`tab-btn text-xs font-bold px-4 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'momentum' ? 'tab-active' : 'tab-inactive'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              النظام 1 (آلي لحظي)
            </button>
            <button
              onClick={() => onTabChange('radar')}
              className={`tab-btn text-xs font-bold px-4 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'radar' ? 'tab-active' : 'tab-inactive'
              }`}
            >
              <Radar className="w-3.5 h-3.5" />
              النظام 2 (رادار الانفجارات)
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                className={`transition-all px-2.5 py-1 rounded-full border text-[11px] font-bold flex items-center gap-1.5 shadow-sm cursor-pointer ${
                  notificationsEnabled
                    ? 'bg-blue-500/10 text-brand-blue border-blue-500/40 hover:bg-blue-500/20'
                    : 'bg-gray-800/80 text-gray-300 border-gray-700 hover:border-gray-600 hover:text-white'
                }`}
                title="إعدادات تنبيهات التلجرام الفورية"
              >
                <Send className="w-3 h-3 text-brand-blue" />
                <span className="hidden sm:inline">
                  {notificationsEnabled ? 'التلجرام متصل 📱' : 'ربط التلجرام ⚡'}
                </span>
                {notificationsEnabled && <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse"></span>}
              </button>
            )}

            <button
              onClick={onToggleSound}
              className={`text-gray-400 hover:text-brand-gold transition-colors p-1.5 rounded-full border shadow-sm cursor-pointer ${
                soundEnabled ? 'bg-gray-800 border-brand-gold' : 'border-gray-700'
              }`}
              title="تفعيل التنبيهات الصوتية"
            >
              {soundEnabled ? (
                <Bell className="w-3.5 h-3.5 text-brand-gold" />
              ) : (
                <BellOff className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Status Badge */}
            {isConnected ? (
              <div className="text-[10px] bg-brand-green/20 border border-brand-green/30 text-brand-green px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 bg-brand-green rounded-full animate-pulse"></span>
                سحابي متصل
              </div>
            ) : (
              <div className="text-[10px] bg-brand-blue bg-opacity-20 border border-brand-blue border-opacity-30 text-brand-blue px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 shadow-sm">
                <svg
                  className="w-3 h-3 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                جاري الاتصال...
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Tabs */}
      <div className="md:hidden flex p-3 bg-gray-900 border-b border-gray-800 gap-2 sticky top-16 z-40">
        <button
          onClick={() => onTabChange('momentum')}
          className={`tab-btn flex-1 text-xs font-bold py-2 rounded-md flex justify-center items-center gap-1.5 cursor-pointer ${
            activeTab === 'momentum' ? 'tab-active' : 'tab-inactive'
          }`}
        >
          النظام 1 (آلي)
        </button>
        <button
          onClick={() => onTabChange('radar')}
          className={`tab-btn flex-1 text-xs font-bold py-2 rounded-md flex justify-center items-center gap-1.5 cursor-pointer ${
            activeTab === 'radar' ? 'tab-active' : 'tab-inactive'
          }`}
        >
          النظام 2 (رادار)
        </button>
      </div>
    </>
  );
};
