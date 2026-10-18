import React from 'react';
import { Star, TrendingUp } from 'lucide-react';
import { MarketHealthData } from '../types';
import { formatTimeAgo, getScoreColorClass } from '../utils/formatters';

interface MarketHealthCardProps {
  healthData: MarketHealthData | null;
  autoKill: boolean;
  onToggleAutoKill: (enabled: boolean) => void;
}

export const MarketHealthCard: React.FC<MarketHealthCardProps> = ({
  healthData,
  autoKill,
  onToggleAutoKill,
}) => {
  const score = healthData ? healthData.score : null;
  const logs = healthData?.log || [];
  const lastScoreChangeTime = logs.length > 0 ? logs[0].time : null;

  let containerClass =
    'bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-xl flex flex-col gap-4 transition-all duration-700 relative overflow-hidden';
  let glowClass =
    'absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gray-500 to-transparent opacity-50';
  let circleClass =
    'w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-black text-lg border-2 border-gray-600 text-gray-400 bg-gray-800';
  let barClass =
    'h-1.5 rounded-full transition-all duration-1000 ease-out w-0 bg-gray-500';
  let healthText: React.ReactNode = (
    <span className="text-gray-500 text-[11px] font-bold">جاري استلام البيانات من السيرفر...</span>
  );

  if (score !== null) {
    if (score >= 75) {
      containerClass =
        'bg-gray-900 border border-brand-green/40 rounded-xl p-4 shadow-[0_0_25px_rgba(16,185,129,0.15)] flex flex-col gap-4 transition-all duration-700 relative overflow-hidden';
      glowClass =
        'absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-green to-transparent opacity-80';
      circleClass =
        'w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-black text-lg border-2 border-brand-green text-brand-green bg-brand-green/10 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
      barClass =
        'h-1.5 rounded-full transition-all duration-1000 ease-out bg-brand-green shadow-[0_0_10px_#10B981]';
      healthText = (
        <span className="text-brand-green text-xs font-bold">
          🚀 خاااااااارق (سوق ناري وآمن جداً للانفجارات)
        </span>
      );
    } else if (score >= 55) {
      containerClass =
        'bg-gray-900 border border-brand-gold/40 rounded-xl p-4 shadow-[0_0_25px_rgba(245,158,11,0.1)] flex flex-col gap-4 transition-all duration-700 relative overflow-hidden';
      glowClass =
        'absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-gold to-transparent opacity-60';
      circleClass =
        'w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-black text-lg border-2 border-brand-gold text-brand-gold bg-brand-gold/10 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
      barClass =
        'h-1.5 rounded-full transition-all duration-1000 ease-out bg-brand-gold shadow-[0_0_10px_#F59E0B]';
      healthText = (
        <span className="text-brand-gold text-xs font-bold">
          🟡 إيجابي بحذر (السوق مستقر وجيد للتداول)
        </span>
      );
    } else {
      containerClass =
        'bg-gray-900 border border-brand-red/40 rounded-xl p-4 shadow-[0_0_25px_rgba(239,68,68,0.15)] flex flex-col gap-4 transition-all duration-700 relative overflow-hidden';
      glowClass =
        'absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-red to-transparent opacity-80';
      circleClass =
        'w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-black text-lg border-2 border-brand-red text-brand-red bg-brand-red/10 shadow-[0_0_15px_rgba(239,68,68,0.3)]';
      barClass =
        'h-1.5 rounded-full transition-all duration-1000 ease-out bg-brand-red shadow-[0_0_10px_#EF4444]';
      healthText = (
        <span className="text-brand-red text-xs font-bold">
          🔴 سلبي وخطر (تجنب الدخول - حماية نشطة)
        </span>
      );
    }
  }

  const logsToShow = logs.slice(0, 5);

  return (
    <div className={containerClass}>
      <div className={glowClass}></div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-3">
          <div className={circleClass}>
            {score !== null ? `${score}%` : '--%'}
          </div>
          <div className="flex flex-col">
            <h2 className="text-xs font-black text-white tracking-wide uppercase flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-brand-blue fill-brand-blue" />
              مؤشر الذكاء الاصطناعي للسوق (Market Matrix)
            </h2>
            <div className="mt-1">{healthText}</div>
            {lastScoreChangeTime !== null && (
              <div className="text-[10px] text-gray-400 mt-1.5 bg-gray-950/80 px-2.5 py-1 rounded border border-gray-800/80 w-fit flex items-center gap-1">
                مستقر على هذه النسبة
                <span className="text-white font-bold ml-1">
                  {formatTimeAgo(lastScoreChangeTime)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 bg-gray-950 px-3 py-2 rounded-lg border border-gray-800 shrink-0">
          <label
            htmlFor="setting-auto-kill"
            className="text-[10px] font-bold text-gray-300 cursor-pointer flex items-center gap-2"
          >
            <input
              type="checkbox"
              id="setting-auto-kill"
              checked={autoKill}
              onChange={(e) => onToggleAutoKill(e.target.checked)}
              className="accent-brand-red w-3.5 h-3.5 cursor-pointer"
            />
            تفعيل الحماية الآلية (منع الدخول وقت الخطر)
          </label>
        </div>
      </div>

      <div className="z-10 w-full">
        <div className="w-full bg-gray-950 rounded-full h-1.5 relative overflow-hidden border border-gray-800">
          <div
            className={barClass}
            style={{ width: score !== null ? `${score}%` : '0%' }}
          ></div>
        </div>

        {logsToShow.length > 0 && (
          <div className="mt-4 flex flex-col border-t border-gray-800/50 pt-3">
            <div className="text-[10px] text-gray-400 font-bold mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              سجل تغيرات السوق (آخر 5):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 w-full pt-1">
              {logsToShow.map((entry, index) => {
                const timeStr = new Date(entry.time).toLocaleString('ar-EG', {
                  hour: '2-digit',
                  minute: '2-digit',
                  month: 'numeric',
                  day: 'numeric',
                });
                const sColor = getScoreColorClass(entry.score);
                const isCurrent = index === 0;
                const labelText = isCurrent ? 'الحالي' : `#${index + 1}`;
                const labelClass = isCurrent
                  ? 'bg-brand-blue text-white border-brand-blue'
                  : 'bg-gray-800 text-gray-400 border-gray-700';

                return (
                  <div
                    key={`${entry.time}-${index}`}
                    className={`relative bg-gray-950/80 border ${
                      isCurrent ? 'border-brand-blue/50' : 'border-gray-800'
                    } px-2 py-1.5 rounded-lg flex flex-col justify-center items-center shadow-sm gap-1 mt-1`}
                  >
                    {isCurrent && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-blue"></span>
                      </span>
                    )}
                    <div
                      className={`absolute -top-2.5 right-2 ${labelClass} text-[8px] px-1.5 rounded border font-bold z-10 shadow-sm`}
                    >
                      {labelText}
                    </div>
                    <span
                      className={`font-black ${sColor.text} text-xs dir-ltr mt-0.5`}
                    >
                      {entry.score}%
                    </span>
                    <span className="text-[8px] text-gray-500 font-mono text-center leading-tight">
                      {timeStr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
