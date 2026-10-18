import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Trade } from '../types';

interface PerformanceStatsProps {
  trades: Trade[];
  timeFilter: string;
  onTimeFilterChange: (filter: string) => void;
  openTradesCount: number;
  totalFloatingPnl: number;
}

export const PerformanceStats: React.FC<PerformanceStatsProps> = ({
  trades,
  timeFilter,
  onTimeFilterChange,
  openTradesCount,
  totalFloatingPnl,
}) => {
  const allClosed = trades.filter((t) => t.status === 'won' || t.status === 'lost');

  let filteredClosed = allClosed;
  if (timeFilter !== 'all') {
    const hours = parseInt(timeFilter, 10);
    const timeLimit = Date.now() - hours * 60 * 60 * 1000;
    filteredClosed = allClosed.filter((t) => (t.closeTime || 0) >= timeLimit);
  }

  let won = 0;
  let lost = 0;
  let totalPnl = 0;

  filteredClosed.forEach((trade) => {
    if (trade.status === 'won') won++;
    if (trade.status === 'lost') lost++;
    totalPnl += trade.pnl || 0;
  });

  const closedCount = won + lost;
  const winRate = closedCount > 0 ? (won / closedCount) * 100 : 0;

  const isFloatingWin = totalFloatingPnl > 0;
  const isFloatingLoss = totalFloatingPnl < 0;

  let floatingClass = 'text-gray-500 bg-gray-900 border-gray-700';
  if (isFloatingWin) {
    floatingClass = 'text-brand-green bg-brand-green/10 border-brand-green/30';
  } else if (isFloatingLoss) {
    floatingClass = 'text-brand-red bg-brand-red/10 border-brand-red/30';
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-brand-blue" />
          إحصائيات الأداء
        </h2>
        <div className="input-group sm:w-48">
          <select
            value={timeFilter}
            onChange={(e) => onTimeFilterChange(e.target.value)}
            className="!py-1.5 !text-xs !bg-gray-950 !text-brand-gold !font-bold !border-gray-700"
          >
            <option value="all">كل الأوقات</option>
            <option value="1">آخر ساعة</option>
            <option value="4">آخر 4 ساعات</option>
            <option value="6">آخر 6 ساعات</option>
            <option value="12">آخر 12 ساعة</option>
            <option value="24">آخر 24 ساعة</option>
            <option value="168">آخر 7 أيام</option>
            <option value="720">آخر 30 يوم</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="stat-box">
          <div className="text-[11px] text-gray-400 mb-1.5 font-bold uppercase tracking-wider">
            إجمالي الصفقات
          </div>
          <div className="text-3xl font-black text-white">{closedCount}</div>
        </div>

        <div className="stat-box">
          <div className="text-[11px] text-gray-400 mb-1.5 font-bold uppercase tracking-wider">
            معدل النجاح (Win Rate)
          </div>
          <div className="text-3xl font-black text-brand-blue">{winRate.toFixed(1)}%</div>
        </div>

        <div className="stat-box">
          <div className="text-[11px] text-gray-400 mb-1.5 font-bold uppercase tracking-wider">
            صافي الربح
          </div>
          <div
            className={`text-3xl font-black dir-ltr ${
              totalPnl >= 0 ? 'text-brand-green' : 'text-brand-red'
            }`}
          >
            {totalPnl > 0 ? '+' : ''}
            {totalPnl.toFixed(2)}%
          </div>
        </div>

        <div className="stat-box border-brand-green/30 bg-brand-green/5 flex flex-col justify-center">
          <div className="text-[11px] text-brand-green mb-1.5 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
            صفقات مفتوحة
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="text-3xl font-black text-brand-green leading-none">
              {openTradesCount}
            </div>
            <div
              className={`text-[12px] font-black dir-ltr mt-1 px-2 py-0.5 rounded border ${floatingClass}`}
              title="إجمالي الأرباح/الخسائر الحالية للصفقات المفتوحة"
            >
              ({totalFloatingPnl > 0 ? '+' : ''}
              {totalFloatingPnl.toFixed(2)}%)
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
