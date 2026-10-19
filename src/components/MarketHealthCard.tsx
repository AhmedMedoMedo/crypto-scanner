import React, { useState } from 'react';
import {
  Star,
  TrendingUp,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Globe2,
  Timer,
  ShieldAlert,
  Flame,
} from 'lucide-react';
import { MarketHealthData, TimeframeMatrixScore } from '../types';
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
  const [activeTab, setActiveTab] = useState<'all' | 'macro' | 'micro'>('all');

  const score = healthData ? healthData.score : null;
  const logs = healthData?.log || [];
  const lastScoreChangeTime = logs.length > 0 ? logs[0].time : null;
  const matrix = healthData?.matrix;
  const isScalpOpportunity = healthData?.scalpOpportunity ?? (score !== null && score >= 65);
  const targetProjection = healthData?.targetProjection || '+4.0% - +6.5%';
  const recommendation = healthData?.recommendation;
  const macroScore = healthData?.macroScore ?? 50;
  const microScore = healthData?.microScore ?? 50;
  const macroMicroSynergy = healthData?.macroMicroSynergy || 'MIXED_DIVERGENCE';
  const synergyLabel = healthData?.synergyLabel;

  let containerClass =
    'bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-xl flex flex-col gap-4 transition-all duration-700 relative overflow-hidden';
  let glowClass =
    'absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gray-500 to-transparent opacity-50';
  let circleClass =
    'w-14 h-14 shrink-0 rounded-full flex items-center justify-center font-black text-xl border-2 border-gray-600 text-gray-400 bg-gray-800 shadow-md';
  let barClass =
    'h-1.5 rounded-full transition-all duration-1000 ease-out w-0 bg-gray-500';
  let healthText: React.ReactNode = (
    <span className="text-gray-500 text-[11px] font-bold">
      جاري تحليل مصفوفة السوق والذكاء الاصطناعي (5 أطر زمنية)...
    </span>
  );

  if (score !== null) {
    if (score >= 72) {
      containerClass =
        'bg-gray-900 border border-brand-green/40 rounded-xl p-4 shadow-[0_0_25px_rgba(16,185,129,0.15)] flex flex-col gap-4 transition-all duration-700 relative overflow-hidden';
      glowClass =
        'absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-green to-transparent opacity-80';
      circleClass =
        'w-14 h-14 shrink-0 rounded-full flex items-center justify-center font-black text-xl border-2 border-brand-green text-brand-green bg-brand-green/10 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
      barClass =
        'h-1.5 rounded-full transition-all duration-1000 ease-out bg-brand-green shadow-[0_0_10px_#10B981]';
      healthText = (
        <span className="text-brand-green text-xs font-bold flex items-center gap-1">
          🚀 خاااااااارق (مصفوفة صاعدة متكاملة - مهيأة لاقتناص أهداف +4% وامتدادات كبرى)
        </span>
      );
    } else if (score >= 52) {
      containerClass =
        'bg-gray-900 border border-brand-gold/40 rounded-xl p-4 shadow-[0_0_25px_rgba(245,158,11,0.1)] flex flex-col gap-4 transition-all duration-700 relative overflow-hidden';
      glowClass =
        'absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-gold to-transparent opacity-60';
      circleClass =
        'w-14 h-14 shrink-0 rounded-full flex items-center justify-center font-black text-xl border-2 border-brand-gold text-brand-gold bg-brand-gold/10 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
      barClass =
        'h-1.5 rounded-full transition-all duration-1000 ease-out bg-brand-gold shadow-[0_0_10px_#F59E0B]';
      healthText = (
        <span className="text-brand-gold text-xs font-bold flex items-center gap-1">
          🟡 إيجابي بحذر (توازن بين الماكرو والمايكرو - التزم بإشارات السكالبينج الصارمة)
        </span>
      );
    } else {
      containerClass =
        'bg-gray-900 border border-brand-red/40 rounded-xl p-4 shadow-[0_0_25px_rgba(239,68,68,0.15)] flex flex-col gap-4 transition-all duration-700 relative overflow-hidden';
      glowClass =
        'absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-red to-transparent opacity-80';
      circleClass =
        'w-14 h-14 shrink-0 rounded-full flex items-center justify-center font-black text-xl border-2 border-brand-red text-brand-red bg-brand-red/10 shadow-[0_0_15px_rgba(239,68,68,0.3)]';
      barClass =
        'h-1.5 rounded-full transition-all duration-1000 ease-out bg-brand-red shadow-[0_0_10px_#EF4444]';
      healthText = (
        <span className="text-brand-red text-xs font-bold flex items-center gap-1">
          🔴 سلبي وخطر (ضغط تصحيحي في الماكرو - حماية المحفظة نشطة)
        </span>
      );
    }
  }

  const logsToShow = logs.slice(0, 5);

  const renderTfCard = (
    tfKey: '1m' | '5m' | '15m' | '1h' | '4h',
    title: string,
    badgeType: 'macro' | 'micro',
    item?: TimeframeMatrixScore
  ) => {
    const tfScore = item ? item.score : (score ?? 50);
    const tfStatus =
      item?.status || (tfScore >= 65 ? 'bullish' : tfScore >= 45 ? 'neutral' : 'bearish');
    const tfRsi = item ? item.rsi : 55;
    const tfVol = item ? item.volRatio : 1.2;
    const tfTrend = item ? item.trend : tfScore >= 60 ? 'up' : tfScore <= 40 ? 'down' : 'flat';

    let badgeBg = 'bg-gray-800 text-gray-400 border-gray-700';
    let statusText = 'محايد';
    if (tfStatus === 'bullish') {
      badgeBg = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      statusText = 'صاعد 🚀';
    } else if (tfStatus === 'bearish') {
      badgeBg = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      statusText = 'هابط 🔴';
    } else {
      badgeBg = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      statusText = 'تذبذب 🟡';
    }

    const isMacro = badgeType === 'macro';

    return (
      <div
        className={`bg-gray-950/70 border ${
          isMacro ? 'border-blue-900/40' : 'border-gray-800'
        } hover:border-gray-700 rounded-lg p-2.5 flex flex-col justify-between transition-all shadow-sm`}
      >
        <div className="flex items-center justify-between gap-1 mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs font-black text-white px-1.5 py-0.5 rounded ${
                isMacro ? 'bg-blue-950 border border-blue-800 text-blue-300' : 'bg-gray-800 border border-gray-700'
              } font-mono`}
            >
              {tfKey}
            </span>
            <span className="text-[11px] font-bold text-gray-300 truncate">
              {title}
            </span>
          </div>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badgeBg}`}>
            {statusText}
          </span>
        </div>

        {/* Score & Progress */}
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[10px] text-gray-400">
            {isMacro ? 'قوة الاتجاه العام:' : 'قوة الزخم اللحظي:'}
          </span>
          <span className="text-sm font-black text-white font-mono dir-ltr">
            {tfScore}%
          </span>
        </div>
        <div className="w-full bg-gray-900 rounded-full h-1 relative overflow-hidden mb-2.5">
          <div
            className={`h-full rounded-full ${
              tfScore >= 65 ? 'bg-emerald-400' : tfScore >= 45 ? 'bg-amber-400' : 'bg-rose-400'
            }`}
            style={{ width: `${tfScore}%` }}
          ></div>
        </div>

        {/* Indicators */}
        <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-gray-900 text-[10px]">
          <div className="flex flex-col items-center bg-gray-900/60 p-1 rounded">
            <span className="text-[9px] text-gray-500">RSI</span>
            <span
              className={`font-mono font-bold ${
                tfRsi >= 50 && tfRsi <= 68 ? 'text-emerald-400' : 'text-gray-300'
              }`}
            >
              {tfRsi}
            </span>
          </div>

          <div className="flex flex-col items-center bg-gray-900/60 p-1 rounded">
            <span className="text-[9px] text-gray-500">الاتجاه</span>
            <span className="font-bold flex items-center gap-0.5">
              {tfTrend === 'up' ? (
                <ArrowUpRight className="w-3 h-3 text-emerald-400" />
              ) : tfTrend === 'down' ? (
                <ArrowDownRight className="w-3 h-3 text-rose-400" />
              ) : (
                <Minus className="w-3 h-3 text-amber-400" />
              )}
              <span className="text-[9px] text-gray-300">
                {tfTrend === 'up' ? 'صاعد' : tfTrend === 'down' ? 'هابط' : 'أفقي'}
              </span>
            </span>
          </div>

          <div className="flex flex-col items-center bg-gray-900/60 p-1 rounded">
            <span className="text-[9px] text-gray-500">السيولة</span>
            <span className="font-mono font-bold text-brand-gold text-[9px]">
              {tfVol}x
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={containerClass}>
      <div className={glowClass}></div>

      {/* Top Main Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-3.5">
          <div className={circleClass}>
            {score !== null ? `${score}%` : '--%'}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-1.5">
                <Star className="w-4 h-4 text-brand-blue fill-brand-blue" />
                مؤشر الذكاء الاصطناعي للسوق (Market Matrix 5-TF)
              </h2>
              <span className="bg-blue-950/80 text-blue-400 border border-blue-800/60 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Globe2 className="w-2.5 h-2.5" />
                الماكرو (4h & 1h)
              </span>
              <span className="bg-brand-blue/15 text-brand-blue border border-brand-blue/30 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 fill-current" />
                السكالبينج (15m & 5m & 1m)
              </span>
            </div>

            <div className="mt-1">{healthText}</div>

            <div className="flex items-center flex-wrap gap-2 mt-1.5">
              {isScalpOpportunity && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  هدف الصفقات المرصود: {targetProjection}
                </div>
              )}
              {lastScoreChangeTime !== null && (
                <div className="text-[10px] text-gray-400 bg-gray-950/80 px-2.5 py-0.5 rounded border border-gray-800/80 flex items-center gap-1">
                  مستقر منذ:
                  <span className="text-white font-bold font-mono">
                    {formatTimeAgo(lastScoreChangeTime)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Protection Switch & Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 self-start lg:self-center">
          <div className="flex items-center bg-gray-950 p-1 rounded-lg border border-gray-800 text-[10px] font-bold">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2 py-1 rounded transition-colors ${
                activeTab === 'all' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              كافة الفريمات (5)
            </button>
            <button
              onClick={() => setActiveTab('macro')}
              className={`px-2 py-1 rounded transition-colors ${
                activeTab === 'macro' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              الماكرو (4h / 1h)
            </button>
            <button
              onClick={() => setActiveTab('micro')}
              className={`px-2 py-1 rounded transition-colors ${
                activeTab === 'micro' ? 'bg-brand-gold text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              السكالبينج (15m/5m/1m)
            </button>
          </div>

          <div className="flex items-center gap-2 bg-gray-950 px-3 py-2 rounded-lg border border-gray-800 shrink-0">
            <label
              htmlFor="setting-auto-kill"
              className="text-[11px] font-bold text-gray-300 cursor-pointer flex items-center gap-2"
            >
              <input
                type="checkbox"
                id="setting-auto-kill"
                checked={autoKill}
                onChange={(e) => onToggleAutoKill(e.target.checked)}
                className="accent-brand-red w-4 h-4 cursor-pointer"
              />
              تفعيل الحماية الآلية (منع الدخول وقت الخطر)
            </label>
          </div>
        </div>
      </div>

      {/* Macro & Micro Summary Badges */}
      <div className="z-10 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-gray-300">اتجاه الماكرو المؤسسي (4h + 1h):</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-300 font-mono font-black">{macroScore}%</span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                macroScore >= 65
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : macroScore >= 48
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}
            >
              {macroScore >= 65 ? 'صعود عام آمن 🌊' : macroScore >= 48 ? 'تذبذب ماكرو' : 'ضغط هابط ⚠️'}
            </span>
          </div>
        </div>

        <div className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand-gold" />
            <span className="font-bold text-gray-300">زخم السكالبينج اللحظي (15m + 5m + 1m):</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-brand-gold font-mono font-black">{microScore}%</span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                microScore >= 65
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : microScore >= 48
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}
            >
              {microScore >= 65 ? 'جاهز للانفجار ⚡' : microScore >= 48 ? 'مسار هادئ' : 'سلبي لحظياً'}
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Timeframe Matrix Cards */}
      <div className="z-10 w-full mt-1">
        {(activeTab === 'all' || activeTab === 'macro') && (
          <div className="mb-3">
            <div className="text-[11px] font-bold text-blue-400 mb-1.5 flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5" />
              طبقة الاتجاه الماكرو المؤسسي واليومي (لتحديد مسار الحيتان):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {renderTfCard('4h', 'الاتجاه الماكرو الاستراتيجي', 'macro', matrix?.['4h'])}
              {renderTfCard('1h', 'المسار اليومي وزخم الساعات', 'macro', matrix?.['1h'])}
            </div>
          </div>
        )}

        {(activeTab === 'all' || activeTab === 'micro') && (
          <div>
            <div className="text-[11px] font-bold text-brand-gold mb-1.5 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              طبقة السكالبينج اللحظية لاقتناص فرص +4% أو أكثر:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {renderTfCard('15m', 'قاعدة الهدف +4%', 'micro', matrix?.['15m'])}
              {renderTfCard('5m', 'تأكيد مسار الحركة', 'micro', matrix?.['5m'])}
              {renderTfCard('1m', 'نبض الزخم الفوري', 'micro', matrix?.['1m'])}
            </div>
          </div>
        )}
      </div>

      {/* 5-Timeframe Matrix Synergy Banner */}
      <div
        className={`z-10 border rounded-lg p-3 flex items-center gap-3 ${
          macroMicroSynergy === 'PERFECT_5_TF'
            ? 'bg-gradient-to-r from-emerald-950/80 via-gray-900 to-emerald-950/80 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
            : macroMicroSynergy === 'STRONG_TREND'
            ? 'bg-gradient-to-r from-blue-950/80 via-gray-900 to-blue-950/80 border-blue-500/50'
            : macroMicroSynergy === 'MIXED_DIVERGENCE'
            ? 'bg-gradient-to-r from-amber-950/80 via-gray-900 to-amber-950/80 border-amber-500/50'
            : 'bg-gradient-to-r from-rose-950/80 via-gray-900 to-rose-950/80 border-rose-500/50'
        }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
            macroMicroSynergy === 'PERFECT_5_TF'
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              : macroMicroSynergy === 'STRONG_TREND'
              ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
              : macroMicroSynergy === 'MIXED_DIVERGENCE'
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
          }`}
        >
          {macroMicroSynergy === 'PERFECT_5_TF' ? (
            <Flame className="w-5 h-5 animate-pulse" />
          ) : macroMicroSynergy === 'STRONG_TREND' ? (
            <TrendingUp className="w-5 h-5" />
          ) : macroMicroSynergy === 'MIXED_DIVERGENCE' ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <ShieldAlert className="w-5 h-5" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-white flex items-center gap-1.5">
            مؤشر التوافق الخماسي الذكي:
            <span
              className={
                macroMicroSynergy === 'PERFECT_5_TF'
                  ? 'text-emerald-400'
                  : macroMicroSynergy === 'STRONG_TREND'
                  ? 'text-blue-400'
                  : macroMicroSynergy === 'MIXED_DIVERGENCE'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }
            >
              {synergyLabel || recommendation}
            </span>
          </span>
          <p className="text-[10px] text-gray-300 mt-0.5 leading-relaxed">
            {recommendation}
          </p>
        </div>
      </div>

      {/* Main Bar & History Logs */}
      <div className="z-10 w-full">
        <div className="w-full bg-gray-950 rounded-full h-1.5 relative overflow-hidden border border-gray-800">
          <div
            className={barClass}
            style={{ width: score !== null ? `${score}%` : '0%' }}
          ></div>
        </div>

        {logsToShow.length > 0 && (
          <div className="mt-3.5 flex flex-col border-t border-gray-800/50 pt-2.5">
            <div className="text-[10px] text-gray-400 font-bold mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              سجل تغيرات قوة مصفوفة السوق (Market Matrix Log):
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
                      isCurrent
                        ? 'border-brand-blue/50 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                        : 'border-gray-800'
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
