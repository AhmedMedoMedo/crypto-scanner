import React, { useState } from 'react';
import {
  Wallet,
  PieChart,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertOctagon,
  RefreshCw,
  CheckCircle2,
  Lock,
  Unlock,
  Sliders,
  Zap,
} from 'lucide-react';
import { Trade, MarketHealthData, EmergencyDefenseMode, ScannerSettings } from '../types';

interface SmartPortfolioCardProps {
  trades: Trade[];
  marketHealth: MarketHealthData | null;
  settings: ScannerSettings;
  onSaveSettings: (settings: ScannerSettings) => Promise<boolean>;
  onEmergencyAction: (action: 'tighten_breakeven' | 'close_losing' | 'liquidate_all') => Promise<void>;
}

export const SmartPortfolioCard: React.FC<SmartPortfolioCardProps> = ({
  trades,
  marketHealth,
  settings,
  onSaveSettings,
  onEmergencyAction,
}) => {
  // Initial capital from settings or localStorage (default $1000)
  const initialCapital = settings.portfolio_capital && settings.portfolio_capital > 0
    ? settings.portfolio_capital
    : Number(localStorage.getItem('smart_portfolio_capital') || 1000);

  const maxTrades = settings.max_open_trades && settings.max_open_trades > 0
    ? settings.max_open_trades
    : Number(localStorage.getItem('smart_portfolio_max_trades') || 10);

  const emergencyMode: EmergencyDefenseMode = settings.emergency_defense_mode || 'tighten_breakeven';

  const [capitalInput, setCapitalInput] = useState(initialCapital.toString());
  const [maxTradesInput, setMaxTradesInput] = useState(maxTrades.toString());
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [emergencyExecuting, setEmergencyExecuting] = useState(false);
  const [emergencyMsg, setEmergencyMsg] = useState<string | null>(null);

  // Filter trades
  const openTrades = trades.filter((t) => t.status === 'open');
  const closedTrades = trades.filter((t) => t.status === 'won' || t.status === 'lost');

  // Base per-trade capital allocation based on compounding:
  // Each trade receives a share of current base capital
  const baseAllocation = Math.max(10, initialCapital / maxTrades);

  // 1. Calculate Realized PnL in USD from closed trades
  let realizedPnlUsd = 0;
  closedTrades.forEach((t) => {
    const tradeAlloc = t.allocatedCapital || baseAllocation;
    const pnlPerc = t.pnl || 0;
    realizedPnlUsd += (tradeAlloc * pnlPerc) / 100;
  });

  // Current Realized Capital (Starting + Closed PnL)
  const realizedBalance = Math.max(0, initialCapital + realizedPnlUsd);

  // Dynamic Compounded Allocation per trade:
  // When you win, balance grows, so next trade gets more!
  // When you lose, balance drops, so next trade size automatically shrinks to protect account!
  const currentPerTradeAlloc = Number((realizedBalance / maxTrades).toFixed(2));

  // 2. Calculate Floating (Unrealized) PnL in USD for open trades
  let floatingPnlUsd = 0;
  let totalInvestedCapital = 0;
  let losingOpenCount = 0;
  let winningOpenCount = 0;

  openTrades.forEach((t) => {
    const tradeAlloc = t.allocatedCapital || currentPerTradeAlloc;
    totalInvestedCapital += tradeAlloc;

    const currentPrice = t.currentPrice || t.entryPrice;
    const pnlPerc = t.entryPrice > 0 ? ((currentPrice - t.entryPrice) / t.entryPrice) * 100 : 0;
    const tradeFloatingUsd = (tradeAlloc * pnlPerc) / 100;
    floatingPnlUsd += tradeFloatingUsd;

    if (pnlPerc < 0) losingOpenCount++;
    else winningOpenCount++;
  });

  // 3. Current Live Portfolio Equity
  const currentEquity = realizedBalance + floatingPnlUsd;
  const totalGrowthPercent = initialCapital > 0 ? ((currentEquity - initialCapital) / initialCapital) * 100 : 0;
  const freeCash = Math.max(0, realizedBalance - totalInvestedCapital);
  const investedPercent = realizedBalance > 0 ? Math.min(100, Math.max(0, (totalInvestedCapital / realizedBalance) * 100)) : 0;

  // Market danger detection
  const marketScore = marketHealth?.score ?? 50;
  const isMarketDanger =
    marketScore < 48 ||
    marketHealth?.status === 'bearish' ||
    marketHealth?.macroMicroSynergy === 'BEARISH_DANGER' ||
    (marketHealth?.macroStatus === 'bearish' && marketScore < 55);

  const handleSaveCapitalConfig = async () => {
    const cap = parseFloat(capitalInput);
    const mTrades = parseInt(maxTradesInput, 10);
    if (!cap || cap <= 0 || !mTrades || mTrades <= 0) return;

    setIsSaving(true);
    localStorage.setItem('smart_portfolio_capital', cap.toString());
    localStorage.setItem('smart_portfolio_max_trades', mTrades.toString());

    await onSaveSettings({
      ...settings,
      portfolio_capital: cap,
      max_open_trades: mTrades,
    });

    setIsSaving(false);
    setIsEditing(false);
  };

  const handleEmergencyActionTrigger = async (
    action: 'tighten_breakeven' | 'close_losing' | 'liquidate_all'
  ) => {
    const titles = {
      tighten_breakeven: 'تأمين الصفقات ونقل وقف الخسارة إلى نقطة الدخول (Breakeven)',
      close_losing: `إغلاق الصفقات الخاسرة فوراً (${losingOpenCount} صفقة خاسرة)`,
      liquidate_all: `تسييل وإغلاق جميع الصفقات المفتوحة فوراً (${openTrades.length} صفقة)`,
    };

    if (!window.confirm(`⚠️ تأكيد خطة الطوارئ:\nهل أنت متأكد من تنفيذ ${titles[action]} لحماية رأس المال؟`)) {
      return;
    }

    setEmergencyExecuting(true);
    try {
      await onEmergencyAction(action);
      setEmergencyMsg(`✅ تم تنفيذ: ${titles[action]} بنجاح!`);
      setTimeout(() => setEmergencyMsg(null), 5000);
    } catch {
      setEmergencyMsg('❌ حدث خطأ أثناء تنفيذ الإجراء الطارئ');
      setTimeout(() => setEmergencyMsg(null), 5000);
    } finally {
      setEmergencyExecuting(false);
    }
  };

  const handleDefenseModeChange = async (mode: EmergencyDefenseMode) => {
    await onSaveSettings({
      ...settings,
      emergency_defense_mode: mode,
    });
  };

  return (
    <section className="bg-gradient-to-b from-gray-900 to-[#0e1424] border border-gray-800 rounded-xl p-4 sm:p-5 shadow-2xl relative overflow-hidden transition-all">
      {/* Background Subtle Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-blue/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header & Capital Editor */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 border-b border-gray-800 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              محفظتي وإدارة رأس المال والتقسيم التلقائي
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                Auto-Compounding
              </span>
            </h2>
            <p className="text-[10px] text-gray-400 mt-0.5">
              إعادة تدوير الأرباح آلياً، زيادة حجم الصفقات مع الربح، وتقليصه عند الخسارة لحماية المحفظة.
            </p>
          </div>
        </div>

        {/* Quick Edit Capital Button & Form */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <div className="flex items-center gap-2 bg-gray-950 p-1.5 rounded-lg border border-gray-700 shadow-inner">
              <div className="flex items-center gap-1">
                <span className="text-xs text-emerald-400 font-bold">$</span>
                <input
                  type="number"
                  value={capitalInput}
                  onChange={(e) => setCapitalInput(e.target.value)}
                  placeholder="رأس المال"
                  className="w-20 bg-gray-900 text-white font-mono text-xs px-2 py-1 rounded border border-gray-700 outline-none focus:border-brand-blue"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400">الصفقات:</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxTradesInput}
                  onChange={(e) => setMaxTradesInput(e.target.value)}
                  className="w-12 bg-gray-900 text-white font-mono text-xs px-1.5 py-1 rounded border border-gray-700 outline-none focus:border-brand-blue text-center"
                />
              </div>
              <button
                onClick={handleSaveCapitalConfig}
                disabled={isSaving}
                className="text-[10px] bg-brand-green hover:bg-emerald-600 text-white font-bold px-2.5 py-1 rounded transition-colors cursor-pointer"
              >
                {isSaving ? 'حفظ...' : 'حفظ'}
              </button>
              <button
                onClick={() => {
                  setCapitalInput(initialCapital.toString());
                  setMaxTradesInput(maxTrades.toString());
                  setIsEditing(false);
                }}
                className="text-[10px] text-gray-400 hover:text-white px-1.5 py-1 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-[11px] bg-gray-950 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Sliders className="w-3.5 h-3.5 text-brand-gold" />
              تعديل رأس المال ({initialCapital.toLocaleString()}$) والتقسيم ({maxTrades})
            </button>
          )}
        </div>
      </div>

      {/* 4 Core Financial Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* Metric 1: Live Portfolio Equity */}
        <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-3 flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between text-gray-400 text-[11px] font-bold mb-1">
            <span>القيمة الكلية الحية (Equity)</span>
            <DollarSign className="w-3.5 h-3.5 text-brand-gold" />
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-xl sm:text-2xl font-black text-white font-mono dir-ltr">
              ${currentEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-gray-400">النمو التراكمي:</span>
            <span
              className={`font-mono font-bold dir-ltr ${
                totalGrowthPercent >= 0 ? 'text-brand-green' : 'text-brand-red'
              }`}
            >
              {totalGrowthPercent >= 0 ? '+' : ''}
              {totalGrowthPercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Metric 2: Next Trade Allocation (Auto-Sized) */}
        <div className="bg-gray-950/80 border border-brand-blue/30 rounded-xl p-3 flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between text-brand-blue text-[11px] font-bold mb-1">
            <span>حجم دخول الصفقة القادمة</span>
            <Zap className="w-3.5 h-3.5 text-brand-blue" />
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-xl sm:text-2xl font-black text-brand-blue font-mono dir-ltr">
              ${currentPerTradeAlloc.toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] text-gray-400 flex items-center justify-between">
            <span>تقسيم: محفظتك ÷ {maxTrades} صفقات</span>
            <span className="text-brand-gold font-bold font-mono">
              {((1 / maxTrades) * 100).toFixed(0)}% / صفقة
            </span>
          </div>
        </div>

        {/* Metric 3: Realized Profit in Dollars */}
        <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-3 flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between text-gray-400 text-[11px] font-bold mb-1">
            <span>الأرباح المحققة (المغلقة)</span>
            {realizedPnlUsd >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-brand-green" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-brand-red" />
            )}
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span
              className={`text-xl sm:text-2xl font-black font-mono dir-ltr ${
                realizedPnlUsd >= 0 ? 'text-brand-green' : 'text-brand-red'
              }`}
            >
              {realizedPnlUsd >= 0 ? '+' : ''}${realizedPnlUsd.toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] text-gray-400">
            أُعيد تدويرها تلقائياً بالرصيد ({closedTrades.length} صفقة)
          </div>
        </div>

        {/* Metric 4: Floating PnL & Free Cash */}
        <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-3 flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between text-gray-400 text-[11px] font-bold mb-1">
            <span>الأرباح العائمة اللحظية</span>
            <PieChart className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span
              className={`text-xl sm:text-2xl font-black font-mono dir-ltr ${
                floatingPnlUsd >= 0 ? 'text-brand-green' : 'text-brand-red'
              }`}
            >
              {floatingPnlUsd >= 0 ? '+' : ''}${floatingPnlUsd.toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] text-gray-400 flex items-center justify-between">
            <span>الكاش الحر المتاح:</span>
            <span className="text-white font-mono font-bold">${freeCash.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Capital Utilization Progress Bar */}
      <div className="bg-gray-950/60 p-2.5 rounded-lg border border-gray-800 mb-4">
        <div className="flex justify-between items-center text-[10px] text-gray-400 mb-1.5 font-bold">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-blue"></span>
            السيولة المستثمرة بالصفقات: ${totalInvestedCapital.toFixed(1)} ({investedPercent.toFixed(1)}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            كاش حر للصفقات القادمة: ${freeCash.toFixed(1)} ({(100 - investedPercent).toFixed(1)}%)
          </span>
        </div>
        <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden flex border border-gray-800">
          <div
            className="bg-brand-blue h-full transition-all duration-700"
            style={{ width: `${investedPercent}%` }}
          ></div>
          <div
            className="bg-emerald-500/60 h-full transition-all duration-700"
            style={{ width: `${100 - investedPercent}%` }}
          ></div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🚨 خطة الطوارئ وحماية الصفقات المفتوحة وقت خطر السوق 🚨 */}
      {/* ======================================================== */}
      <div
        className={`rounded-xl p-3.5 border transition-all ${
          isMarketDanger
            ? 'bg-red-950/30 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)] animate-pulse-slow'
            : 'bg-gray-950/40 border-gray-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg ${
                isMarketDanger
                  ? 'bg-red-500/20 text-brand-red border border-red-500/40 animate-bounce'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">
                  خطة الطوارئ وحماية الصفقات المفتوحة وقت الخطر
                </span>
                {isMarketDanger ? (
                  <span className="text-[9px] bg-red-500 text-white font-black px-2 py-0.5 rounded-full animate-pulse">
                    ⚠️ السوق في مرحلة خطر وهبوط حاد!
                  </span>
                ) : (
                  <span className="text-[9px] bg-gray-800 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    حالة السوق آمنة حالياً ({marketScore}%)
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                تمنع غرق الصفقات المفتوحة في الخسائر عند هبوط السوق عبر حجز الأرباح ونقل الوقف للدخول أو تسييل المحفظة.
              </p>
            </div>
          </div>

          {/* Defense Mode Selector */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <span className="text-[10px] text-gray-400">إجراء الدفاع:</span>
            <select
              value={emergencyMode}
              onChange={(e) => handleDefenseModeChange(e.target.value as EmergencyDefenseMode)}
              className="text-[10px] bg-gray-900 text-brand-gold font-bold border border-gray-700 rounded px-2 py-1 outline-none cursor-pointer focus:border-brand-gold"
            >
              <option value="tighten_breakeven">🛡️ نقل الوقف لنقطة الدخول (Breakeven)</option>
              <option value="close_losing">🔴 إغلاق الصفقات الخاسرة فوراً</option>
              <option value="liquidate_all">⚠️ تسييل كامل المحفظة كاش</option>
              <option value="alert_only">🔔 تنبيه فقط بدون إغلاق تلقائي</option>
            </select>
          </div>
        </div>

        {/* Emergency Feedback Message */}
        {emergencyMsg && (
          <div className="mb-2 p-2 bg-gray-900 border border-brand-gold/40 text-brand-gold text-xs rounded-lg font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-gold" />
            {emergencyMsg}
          </div>
        )}

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-800/80">
          <button
            onClick={() => handleEmergencyActionTrigger('tighten_breakeven')}
            disabled={emergencyExecuting || openTrades.length === 0}
            className="flex items-center justify-center gap-1.5 text-[11px] font-bold py-2 px-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
            تأمين الصفقات ونقل الوقف للدخول (Breakeven)
          </button>

          <button
            onClick={() => handleEmergencyActionTrigger('close_losing')}
            disabled={emergencyExecuting || losingOpenCount === 0}
            className="flex items-center justify-center gap-1.5 text-[11px] font-bold py-2 px-3 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/40 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
            إغلاق الصفقات الخاسرة فوراً ({losingOpenCount} صفقات)
          </button>

          <button
            onClick={() => handleEmergencyActionTrigger('liquidate_all')}
            disabled={emergencyExecuting || openTrades.length === 0}
            className="flex items-center justify-center gap-1.5 text-[11px] font-bold py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-white" />
            تسييل كامل الصفقات كاش USDT ({openTrades.length})
          </button>
        </div>
      </div>
    </section>
  );
};
