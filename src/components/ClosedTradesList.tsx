import React, { useState } from 'react';
import { History, Trash2, Clock } from 'lucide-react';
import { Trade } from '../types';
import { formatDuration } from '../utils/formatters';

interface ClosedTradesListProps {
  trades: Trade[];
  timeFilter: string;
  onClearHistory: () => Promise<void>;
}

export const ClosedTradesList: React.FC<ClosedTradesListProps> = ({
  trades,
  timeFilter,
  onClearHistory,
}) => {
  const [clearing, setClearing] = useState(false);

  const allClosed = trades.filter((t) => t.status === 'won' || t.status === 'lost');

  let filteredClosed = allClosed;
  if (timeFilter !== 'all') {
    const hours = parseInt(timeFilter, 10);
    const timeLimit = Date.now() - hours * 60 * 60 * 1000;
    filteredClosed = allClosed.filter((t) => (t.closeTime || 0) >= timeLimit);
  }

  const [displayLimit, setDisplayLimit] = useState(100);

  const sortedClosed = [...filteredClosed].sort(
    (a, b) => (b.closeTime || 0) - (a.closeTime || 0)
  );

  const visibleClosed = sortedClosed.slice(0, displayLimit);

  let wonCount = 0;
  let lostCount = 0;
  let totalClosedPnl = 0;
  filteredClosed.forEach((t) => {
    if (t.status === 'won') wonCount++;
    if (t.status === 'lost') lostCount++;
    totalClosedPnl += t.pnl || 0;
  });

  const handleClear = async () => {
    if (
      !window.confirm(
        '⚠️ تحذير هام: هل أنت متأكد من مسح سجل الصفقات المغلقة؟ سيتم الاحتفاظ بنسخة أرشيفية محلية لحماية بياناتك.'
      )
    )
      return;

    // Backup to local storage before clearing
    try {
      localStorage.setItem('momentum_trades_backup_cleared', JSON.stringify(allClosed));
    } catch {}

    setClearing(true);
    try {
      await onClearHistory();
    } finally {
      setClearing(false);
    }
  };

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
    <div className="mt-8 pt-6 border-t border-gray-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h3 className="text-xs font-bold text-gray-300 flex items-center gap-2">
          <History className="w-4 h-4 text-gray-400" />
          سجل الصفقات المغلقة
          <span className="text-[10px] font-normal text-gray-400 mr-2 bg-gray-950 px-2.5 py-1 rounded-md border border-gray-800 hidden sm:inline-block">
            (إجمالي: {filteredClosed.length} | رابحة:{' '}
            <span className="text-brand-green font-bold">{wonCount}</span> | خاسرة:{' '}
            <span className="text-brand-red font-bold">{lostCount}</span>)
          </span>
        </h3>
        <button
          onClick={handleClear}
          disabled={clearing || filteredClosed.length === 0}
          className="flex items-center justify-center gap-1.5 text-[10px] bg-red-500/10 hover:bg-red-500/20 text-brand-red px-3 py-1.5 rounded-md border border-red-500/30 transition-all shadow-sm cursor-pointer disabled:opacity-50"
        >
          <Trash2 className="w-3 h-3" />
          {clearing ? 'جاري الحذف...' : 'مسح السجل'}
        </button>
      </div>

      <div className="text-[10px] text-center text-gray-400 bg-gray-950 px-2 py-1.5 rounded-md border border-gray-800 mb-3 sm:hidden">
        (إجمالي: {filteredClosed.length} | رابحة:{' '}
        <span className="text-brand-green font-bold">{wonCount}</span> | خاسرة:{' '}
        <span className="text-brand-red font-bold">{lostCount}</span>)
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
        {sortedClosed.length === 0 ? (
          <div className="text-[11px] text-gray-500 text-center py-8 bg-gray-950 rounded-lg border border-gray-800 border-dashed">
            لم يتم إغلاق أي صفقة بعد
          </div>
        ) : (
          visibleClosed.map((t) => {
            const isWin = t.status === 'won';
            const pColor = isWin ? 'text-brand-green' : 'text-brand-red';
            const bgColor = isWin
              ? 'bg-brand-green/5 border-brand-green/20'
              : 'bg-brand-red/5 border-brand-red/20';
            const icon = isWin ? '✓' : '✗';
            const durationStr =
              t.openTime && t.closeTime && t.closeTime > t.openTime
                ? formatDuration(t.closeTime - t.openTime)
                : 'غير محدد';
            const timeStr = t.closeTime
              ? new Date(t.closeTime).toLocaleTimeString('ar-EG', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '--:--';

            return (
              <div
                key={t.docId}
                className={`flex items-center justify-between p-2.5 rounded-lg border ${bgColor} hover:bg-gray-800/80 transition-colors mb-2 gap-2`}
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-bold text-white text-xs truncate" title={t.symbol}>
                      {t.symbol}
                    </span>
                    {getStrategyBadgeElement(t.strategy)}
                    {t.entryScore && (
                      <span
                        className="text-[8px] bg-gray-900 border border-gray-700 px-1 rounded text-gray-400"
                        title="Entry Strength Score"
                      >
                        القوة: {t.entryScore}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-gray-500 font-mono">{timeStr}</span>
                    <span className="text-[8px] text-gray-400 bg-gray-950 border border-gray-800 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-inner whitespace-nowrap">
                      <Clock className="w-2 h-2" />
                      استغرقت: {durationStr}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 shrink-0 w-auto">
                  <span className={`dir-ltr font-black text-xs ${pColor}`}>
                    {(t.pnl || 0) > 0 ? '+' : ''}
                    {(t.pnl || 0).toFixed(2)}%
                  </span>
                  <span
                    className={`${pColor} font-bold text-sm bg-gray-950 w-5 h-5 flex items-center justify-center rounded border ${
                      isWin ? 'border-brand-green/50' : 'border-brand-red/50'
                    } shadow-sm`}
                  >
                    {icon}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {sortedClosed.length > visibleClosed.length && (
          <button
            onClick={() => setDisplayLimit((prev) => prev + 100)}
            className="w-full py-2 bg-gray-950 hover:bg-gray-800 border border-gray-800 text-xs font-bold text-brand-blue rounded-lg transition-colors cursor-pointer mt-2 flex items-center justify-center gap-1"
          >
            عرض باقي الصفقات ({sortedClosed.length - visibleClosed.length} صفقة إضافية) ⬇️
          </button>
        )}
      </div>
    </div>
  );
};
