import React from 'react';
import { ExternalLink, X, Clock } from 'lucide-react';
import { Trade } from '../types';
import { formatTimeAgo, getScoreColorClass } from '../utils/formatters';

interface ActiveTradesGridProps {
  trades: Trade[];
  sortOption: string;
  onSortChange: (sort: string) => void;
  onCancelTrade: (docId: string) => void;
}

export const ActiveTradesGrid: React.FC<ActiveTradesGridProps> = ({
  trades,
  sortOption,
  onSortChange,
  onCancelTrade,
}) => {
  // Sort trades based on sortOption
  const sortedTrades = [...trades].sort((a, b) => {
    const currentPriceA = a.currentPrice || a.entryPrice;
    const currentPriceB = b.currentPrice || b.entryPrice;
    const pnlA = ((currentPriceA - a.entryPrice) / a.entryPrice) * 100;
    const pnlB = ((currentPriceB - b.entryPrice) / b.entryPrice) * 100;
    const scoreA = a.liveScore || a.entryScore || 0;
    const scoreB = b.liveScore || b.entryScore || 0;

    if (sortOption === 'profit_desc') {
      return pnlB - pnlA;
    } else if (sortOption === 'score_desc') {
      return scoreB - scoreA;
    } else if (sortOption === 'time_asc') {
      return a.openTime - b.openTime;
    } else {
      // Default time_desc
      return b.openTime - a.openTime;
    }
  });

  const getStrategyBadgeElement = (stratName?: string) => {
    if (stratName === 'Sniper') {
      return (
        <span className="badge-sniper text-[8px] font-bold px-1.5 py-0.5 rounded ml-1 shrink-0">
          Sniper
        </span>
      );
    }
    if (stratName === 'Breakout') {
      return (
        <span className="badge-breakout text-[8px] font-bold px-1.5 py-0.5 rounded ml-1 shrink-0">
          Breakout
        </span>
      );
    }
    if (stratName === 'BB_RSI') {
      return (
        <span className="badge-bbrsi text-[8px] font-bold px-1.5 py-0.5 rounded ml-1 shrink-0">
          BB+RSI
        </span>
      );
    }
    if (stratName === 'TurboScalp') {
      return (
        <span className="badge-turboscalp text-[8px] font-bold px-1.5 py-0.5 rounded ml-1 shrink-0">
          ⚡ Turbo 4%+
        </span>
      );
    }
    if (stratName === 'Manual') {
      return (
        <span className="bg-gray-800 text-gray-300 border border-gray-600 text-[8px] font-bold px-1.5 py-0.5 rounded ml-1 shrink-0">
          Manual
        </span>
      );
    }
    return (
      <span className="badge-momentum text-[8px] font-bold px-1.5 py-0.5 rounded ml-1 shrink-0">
        Momentum
      </span>
    );
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3 pb-2 border-b border-gray-800">
        <h3 className="text-xs font-bold text-gray-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse"></span>
          الصفقات المفتوحة حالياً ({trades.length})
        </h3>
        <select
          value={sortOption}
          onChange={(e) => onSortChange(e.target.value)}
          className="!w-auto !py-1 !px-2 !text-[10px] !bg-gray-950 text-brand-gold !font-bold border border-gray-700 rounded shadow-sm outline-none cursor-pointer transition-colors focus:border-brand-gold"
        >
          <option value="time_desc">ترتيب حسب: الأحدث أولاً</option>
          <option value="time_asc">ترتيب حسب: الأقدم أولاً</option>
          <option value="profit_desc">ترتيب حسب: الأكثر ربحاً (تحديث حي)</option>
          <option value="score_desc">ترتيب حسب: القوة Score (تحديث حي)</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {sortedTrades.length === 0 ? (
          <div className="col-span-full text-xs text-gray-500 text-center py-8 bg-gray-950 rounded-lg border border-gray-800 border-dashed">
            لا توجد صفقات مفتوحة حالياً... بانتظار الفرص
          </div>
        ) : (
          sortedTrades.map((t) => {
            const currentPrice = t.currentPrice || t.entryPrice;
            const currentPnl = ((currentPrice - t.entryPrice) / t.entryPrice) * 100;
            const isWin = currentPnl >= 0;
            const pnlColor = isWin ? 'text-brand-green' : 'text-brand-red';
            const cardBorder = isWin ? 'border-brand-green/30' : 'border-brand-red/30';
            const trailStatus = t.trailActive
              ? '✨ ملاحقة نشطة'
              : `الوقف: ${(t.slLevel || 0).toPrecision(5)}`;
            const timeAgoText = formatTimeAgo(t.openTime);
            const displayScore = t.liveScore || t.entryScore;
            const sColor = getScoreColorClass(displayScore || 50);
            const brk = t.liveBreakdown ||
              t.entryBreakdown || {
                trend: 0,
                volume: 0,
                rsi: 0,
                setup: 0,
                btc: 0,
                candle: 0,
              };

            let health = {
              text: '⚖️ مسار مستقر',
              class: 'text-brand-gold border-brand-gold/30 bg-brand-gold/10',
            };
            if (displayScore !== undefined) {
              if (displayScore >= 70) {
                health = {
                  text: '🚀 مساحة جيدة للصعود',
                  class:
                    'text-brand-green border-brand-green/30 bg-brand-green/10 shadow-[0_0_8px_rgba(16,185,129,0.1)]',
                };
              } else if (displayScore < 45) {
                health = {
                  text: '📉 تراجع الزخم',
                  class: 'text-gray-400 border-gray-700 bg-gray-800',
                };
              }
              if (currentPnl > 2 && displayScore < 60) {
                health = {
                  text: '⚠️ خطر انعكاس (تشبع)',
                  class:
                    'text-brand-red border-brand-red/30 bg-brand-red/10 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.2)]',
                };
              }
            }

            return (
              <div
                key={t.docId}
                className={`bg-gray-800 border ${cardBorder} rounded-lg shadow-md flex flex-col justify-between hover:border-brand-blue/50 transition-colors relative pt-6 pb-2.5 px-3`}
              >
                <div className="absolute top-0 right-0 bg-gray-900 border-b border-l border-gray-700/50 rounded-bl-lg px-2 py-0.5 text-[9px] text-gray-400 font-bold flex items-center gap-1 z-10">
                  {timeAgoText}
                  <Clock className="w-2.5 h-2.5" />
                </div>

                <div className="flex justify-between items-center mb-1.5 border-b border-gray-700/50 pb-1.5 gap-2">
                  <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                    <span className="text-white font-bold text-xs truncate" title={t.symbol}>
                      {t.symbol}
                    </span>
                    {getStrategyBadgeElement(t.strategy)}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`dir-ltr font-black text-[11px] ${pnlColor}`}>
                      {currentPnl > 0 ? '+' : ''}
                      {currentPnl.toFixed(2)}%
                    </span>
                    <button
                      onClick={() => onCancelTrade(t.docId)}
                      className="text-brand-red hover:text-white transition-colors bg-red-500/10 rounded p-1 hover:bg-brand-red border border-red-500/20 cursor-pointer"
                      title="إلغاء وحذف الصفقة"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                    <a
                      href={`https://www.binance.com/ar/trade/${t.symbol}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors bg-gray-950 rounded p-1 hover:bg-brand-blue"
                      title="تداول على باينانس"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>

                {/* Score & Breakdown */}
                <div className="mb-2 mt-1 px-1 border-t border-gray-700/50 pt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-bold text-gray-400">Live Score</span>
                    <span className={`text-xs font-black ${sColor.text}`}>
                      {displayScore !== undefined ? `${displayScore}%` : '--'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-950 rounded-full h-1 border border-gray-800 mb-1.5">
                    <div
                      className={`h-1 rounded-full ${sColor.bg} transition-all duration-500`}
                      style={{ width: `${displayScore || 0}%` }}
                    ></div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center">
                    <span
                      className="text-[7px] text-gray-400 bg-gray-950 px-1 rounded border border-gray-800"
                      title="Trend"
                    >
                      Tr:{brk.trend}/20
                    </span>
                    <span
                      className="text-[7px] text-gray-400 bg-gray-950 px-1 rounded border border-gray-800"
                      title="Volume"
                    >
                      Vo:{brk.volume}/20
                    </span>
                    <span
                      className="text-[7px] text-gray-400 bg-gray-950 px-1 rounded border border-gray-800"
                      title="RSI"
                    >
                      RS:{brk.rsi}/15
                    </span>
                    <span
                      className="text-[7px] text-gray-400 bg-gray-950 px-1 rounded border border-gray-800"
                      title="Setup"
                    >
                      St:{brk.setup}/15
                    </span>
                    <span
                      className="text-[7px] text-gray-400 bg-gray-950 px-1 rounded border border-gray-800"
                      title="BTC Health"
                    >
                      BT:{brk.btc}/15
                    </span>
                    <span
                      className="text-[7px] text-gray-400 bg-gray-950 px-1 rounded border border-gray-800"
                      title="Candle"
                    >
                      Cn:{brk.candle}/10
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-1 text-[10px] mt-2">
                  <span className="text-gray-400">الدخول:</span>
                  <span className="text-gray-300 font-mono">
                    {(t.entryPrice || 0).toPrecision(5)}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2 text-[10px]">
                  <span className="text-gray-400">الحالي:</span>
                  <span className="text-white font-bold font-mono">
                    {currentPrice.toPrecision(5)}
                  </span>
                </div>
                <div className="mt-auto flex flex-col gap-1.5 pt-1 border-t border-gray-700/50">
                  <div
                    className={`text-[9px] ${health.class} rounded px-1 py-1 text-center font-bold border transition-colors duration-500 truncate`}
                    title={health.text}
                  >
                    {health.text}
                  </div>
                  <div className="text-[10px] text-brand-gold bg-gray-950 rounded px-1 py-1.5 text-center font-bold border border-gray-700">
                    {trailStatus}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
