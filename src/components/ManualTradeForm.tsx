import React, { useState } from 'react';
import { PenTool } from 'lucide-react';
import { Trade } from '../types';

interface ManualTradeFormProps {
  openTrades: Trade[];
  onAddTrade: (trade: Omit<Trade, 'docId'>) => Promise<void>;
}

export const ManualTradeForm: React.FC<ManualTradeFormProps> = ({
  openTrades,
  onAddTrade,
}) => {
  const [symbolInput, setSymbolInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddManualTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    let symbol = symbolInput.trim().toUpperCase();
    if (!symbol) return;
    if (!symbol.endsWith('USDT')) symbol += 'USDT';

    if (openTrades.some((t) => t.symbol === symbol)) {
      alert('هذه الصفقة مفتوحة بالفعل!');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const price = parseFloat(data.price);

      const newTrade: Omit<Trade, 'docId'> = {
        symbol: symbol,
        entryPrice: price,
        currentPrice: price,
        maxPrice: price,
        trailActive: false,
        slLevel: price * 0.97,
        status: 'open',
        openTime: Date.now(),
        strategy: 'Manual',
        entryScore: 75,
        liveScore: 75,
        entryBreakdown: {
          trend: 15,
          volume: 15,
          rsi: 10,
          setup: 10,
          btc: 10,
          candle: 10,
          confirm: 5,
        },
      };

      await onAddTrade(newTrade);
      setSymbolInput('');
    } catch (err) {
      alert('خطأ: تأكد من صحة الرمز (مثال: SOLUSDT)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-2">
        <PenTool className="w-3.5 h-3.5 text-brand-gold" />
        <span className="text-xs font-bold text-gray-300">
          إضافة صفقة يدوية للسيرفر:
        </span>
      </div>
      <form
        onSubmit={handleAddManualTrade}
        className="flex items-center gap-2 w-full sm:w-auto"
      >
        <input
          type="text"
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value)}
          placeholder="مثال: SOLUSDT"
          className="w-full sm:w-48 bg-gray-950 border border-gray-700 text-white text-xs rounded-md px-2 py-1.5 outline-none focus:border-brand-blue uppercase dir-ltr"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-gray-800 hover:bg-brand-blue border border-gray-700 hover:border-brand-blue text-white text-xs font-bold py-1.5 px-3 rounded-md transition-colors shrink-0 whitespace-nowrap shadow-sm cursor-pointer disabled:opacity-50"
        >
          {loading ? 'جاري...' : 'إضافة للصفقات'}
        </button>
      </form>
    </div>
  );
};
