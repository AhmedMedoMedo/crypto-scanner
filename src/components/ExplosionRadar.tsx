import React, { useState, useRef, useMemo } from 'react';
import {
  ExternalLink,
  RefreshCw,
  Layers,
  Zap,
  Calendar,
  ShieldCheck,
  TrendingUp,
  Search,
  LayoutGrid,
  Table as TableIcon,
  Flame,
  Check,
  PlusCircle,
  Clock,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { ExplosionCandidate, Trade } from '../types';

interface ExplosionRadarProps {
  onAddTrade?: (trade: Omit<Trade, 'docId'>) => Promise<void> | void;
}

const calcSMA = (data: number[], period: number): number | null => {
  if (data.length < period || period <= 0) return null;
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) sum += data[i];
  return sum / period;
};

const calcBollinger = (
  data: number[],
  period = 20,
  multiplier = 2.0
): { upper: number; lower: number; sma: number; bandwidth: number } | null => {
  if (data.length < period) return null;
  const sma = calcSMA(data, period);
  if (sma === null || sma === 0) return null;
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) {
    sum += Math.pow(data[i] - sma, 2);
  }
  const stdDev = Math.sqrt(sum / period);
  const upper = sma + stdDev * multiplier;
  const lower = sma - stdDev * multiplier;
  return {
    upper,
    lower,
    sma,
    bandwidth: (upper - lower) / sma,
  };
};

const calcEMA = (data: number[], period: number): number | null => {
  if (data.length < period || period <= 0) return null;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  let ema = sum / period;
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * k + ema;
  }
  return ema;
};

const calcRSI = (closes: number[], period = 14): number | null => {
  if (!closes || closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
};

export const ExplosionRadar: React.FC<ExplosionRadarProps> = ({ onAddTrade }) => {
  const [timeframe, setTimeframe] = useState('15m');
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentCoinText, setCurrentCoinText] = useState('تهيئة محرك البحث الخارق...');
  const [candidates, setCandidates] = useState<ExplosionCandidate[]>([]);
  const [statusMessage, setStatusMessage] = useState<React.ReactNode>('جاهز لبدء فحص أفضل 30 صفقة...');
  const [hasScanned, setHasScanned] = useState(false);

  // View & Filter States
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [filterType, setFilterType] = useState<'all' | 'scalp' | 'swing' | 'elite'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedSymbols, setAddedSymbols] = useState<Record<string, boolean>>({});

  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleCaptureTrade = async (coin: ExplosionCandidate) => {
    if (!onAddTrade) return;
    try {
      const isScalp = coin.tradeType === 'SCALP';
      const slLevel = coin.slPrice || (coin.price * (isScalp ? 0.98 : 0.965));
      await onAddTrade({
        symbol: coin.symbol,
        entryPrice: coin.price,
        currentPrice: coin.price,
        maxPrice: coin.price,
        slLevel: slLevel,
        status: 'open',
        openTime: Date.now(),
        strategy: isScalp ? 'TurboScalp' : 'Momentum',
        entryScore: coin.score,
      });

      setAddedSymbols((prev) => ({ ...prev, [coin.symbol]: true }));
      setTimeout(() => {
        setAddedSymbols((prev) => {
          const updated = { ...prev };
          delete updated[coin.symbol];
          return updated;
        });
      }, 5000);
    } catch (e) {
      console.error('Error adding trade from radar', e);
    }
  };

  const startScan = async () => {
    if (isScanning) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsScanning(false);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsScanning(true);
    setHasScanned(true);
    setProgress(0);
    setCandidates([]);
    setStatusMessage(
      <span className="text-brand-cyan animate-pulse">
        جاري مسح أفضل 30 صفقة في السوق ({timeframe.toUpperCase()}) 🔍
      </span>
    );

    const rawCandidates: ExplosionCandidate[] = [];

    try {
      setCurrentCoinText('جلب خريطة السيولة المحدثة من باينانس...');

      let tickers: any = null;
      try {
        const tickerRes = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr', {
          signal: abortController.signal,
        });
        if (tickerRes.ok) {
          tickers = await tickerRes.json();
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
      }

      if (!Array.isArray(tickers)) {
        try {
          const fallbackRes = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
            signal: abortController.signal,
          });
          if (fallbackRes.ok) {
            tickers = await fallbackRes.json();
          }
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') throw err;
        }
      }

      if (!Array.isArray(tickers)) {
        throw new Error('Could not fetch market tickers');
      }

      const stableCoins = [
        'USDCUSDT',
        'USD1USDT',
        'FDUSDUSDT',
        'TUSDUSDT',
        'BUSDUSDT',
        'EURUSDT',
        'USDPUSDT',
        'AEURUSDT',
        'USDSUSDT',
      ];

      const targetCoins = tickers
        .filter((t: { symbol: string; lastPrice: string; quoteVolume: string }) => {
          return (
            t.symbol.endsWith('USDT') &&
            parseFloat(t.lastPrice) > 0.0005 &&
            parseFloat(t.quoteVolume) > 3500000 &&
            !stableCoins.includes(t.symbol)
          );
        })
        .sort(
          (a: { quoteVolume: string }, b: { quoteVolume: string }) =>
            parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)
        )
        .slice(0, 75); // Scan top 75 highest volume coins to extract the definitive TOP 30

      for (let i = 0; i < targetCoins.length; i++) {
        if (abortController.signal.aborted) break;

        const coin = targetCoins[i];
        setCurrentCoinText(
          `تحليل الفرصة (${timeframe.toUpperCase()}): ${coin.symbol} (${i + 1}/${targetCoins.length})`
        );
        const curProgress = Math.round(((i + 1) / targetCoins.length) * 100);
        setProgress(curProgress);

        try {
          let klines: any = null;
          try {
            const klineRes = await fetch(
              `https://data-api.binance.vision/api/v3/klines?symbol=${coin.symbol}&interval=${timeframe}&limit=100`,
              { signal: abortController.signal }
            );
            if (klineRes.ok) {
              klines = await klineRes.json();
            }
          } catch (err) {
            if ((err as Error)?.name === 'AbortError') break;
          }

          if (!Array.isArray(klines) || klines.length < 50) {
            try {
              const fallbackRes = await fetch(
                `https://api.binance.com/api/v3/klines?symbol=${coin.symbol}&interval=${timeframe}&limit=100`,
                { signal: abortController.signal }
              );
              if (fallbackRes.ok) {
                klines = await fallbackRes.json();
              }
            } catch (err) {
              if ((err as Error)?.name === 'AbortError') break;
            }
          }

          if (!Array.isArray(klines) || klines.length < 50) continue;

          const closes = klines.map((k: (string | number)[]) => parseFloat(k[4] as string));
          const opens = klines.map((k: (string | number)[]) => parseFloat(k[1] as string));
          const highs = klines.map((k: (string | number)[]) => parseFloat(k[2] as string));
          const lows = klines.map((k: (string | number)[]) => parseFloat(k[3] as string));
          const volumes = klines.map((k: (string | number)[]) => parseFloat(k[5] as string));

          const currentPrice = closes[closes.length - 1];
          const closedCloses = closes.slice(0, -1);
          const closedVolumes = volumes.slice(0, -1);
          const closedOpens = opens.slice(0, -1);
          const closedHighs = highs.slice(0, -1);
          const closedLows = lows.slice(0, -1);

          const bb = calcBollinger(closedCloses, 20, 2);
          const ema50 = calcEMA(closedCloses, 50);
          const ema9 = calcEMA(closedCloses, 9);
          const ema21 = calcEMA(closedCloses, 21);
          const volAvg20 = calcSMA(closedVolumes, 20);
          const rsi = Math.round(calcRSI(closedCloses, 14) || 50);

          if (!bb || !ema50 || !volAvg20 || currentPrice <= 0) continue;

          const lastClosedPrice = closedCloses[closedCloses.length - 1];
          const lastClosedOpen = closedOpens[closedOpens.length - 1];
          const isGreenCandle = lastClosedPrice >= lastClosedOpen;
          const currentVol = closedVolumes[closedVolumes.length - 1];
          const volRatio = volAvg20 > 0 ? currentVol / volAvg20 : 1;

          let score = 20; // base score
          const reasons: string[] = [];

          // 1. Bollinger Squeeze & Expansion
          const isSqueezing = bb.bandwidth < 0.08;
          if (isSqueezing) {
            score += 35;
            reasons.push('انضغاط سعري حاد (Squeeze)');
          } else if (bb.bandwidth < 0.13) {
            score += 22;
            reasons.push('تجهيز لانفجار سعري');
          }

          // 2. Whale Volume Surge
          if (volRatio >= 2.5) {
            score += 30;
            reasons.push(`دخول سيولة حيتان (حجم ×${volRatio.toFixed(1)})`);
          } else if (volRatio >= 1.5) {
            score += 15;
            reasons.push(`ارتفاع ملحوظ في الحجم (×${volRatio.toFixed(1)})`);
          }

          // 3. Trend Alignment
          if (currentPrice > ema50) {
            score += 15;
            reasons.push('تمركز أعلى متوسط EMA50');
          }

          if (ema9 && ema21 && ema9 > ema21) {
            score += 10;
          }

          // 4. RSI Runway
          if (rsi >= 50 && rsi <= 68) {
            score += 18;
            reasons.push(`زخم مثالي (RSI ${rsi})`);
          } else if (rsi > 68 && rsi <= 76) {
            score += 8;
          } else if (rsi < 40) {
            score -= 15;
          }

          if (isGreenCandle) {
            score += 8;
          }

          // Trade Category & Duration Determination
          const isScalpTf = ['1m', '5m', '15m'].includes(timeframe);
          const tradeType: 'SCALP' | 'SWING_1_2_DAYS' = isScalpTf ? 'SCALP' : 'SWING_1_2_DAYS';

          let holdingPeriod = '15 دقيقة - 3 ساعات';
          if (timeframe === '1m') holdingPeriod = '10 - 45 دقيقة (سكالبينج خاطف ⚡)';
          else if (timeframe === '5m') holdingPeriod = '30 دقيقة - ساعتين (سكالبينج ⚡)';
          else if (timeframe === '15m') holdingPeriod = '1 - 4 ساعات (سكالبينج تكتيكي ⚡)';
          else if (timeframe === '1h') holdingPeriod = '24 ساعة - 48 ساعة (سوينغ يوم/يومين 🚀)';
          else if (timeframe === '4h') holdingPeriod = 'يوم إلى يومين كحد أقصى (سوينغ 48h 🚀)';
          else holdingPeriod = '1 - 3 أيام (سوينغ موجي 🌊)';

          // Distance to upper BB
          const distToUpperBB = ((bb.upper - currentPrice) / currentPrice) * 100;

          // Projected Target % Calculation
          let projectedTarget = 4.0;
          let slPercent = 2.0;

          if (tradeType === 'SCALP') {
            projectedTarget = distToUpperBB > 1.0 ? distToUpperBB : Math.max(4.0, bb.bandwidth * 55);
            if (projectedTarget < 4.0) projectedTarget = 4.0 + (score > 70 ? 2.2 : 0.8);
            slPercent = 2.0;
          } else {
            // Swing (1 to 2 days) targets 8% to 22%+
            projectedTarget = distToUpperBB > 3.0 ? distToUpperBB * 1.4 : Math.max(8.0, bb.bandwidth * 90);
            if (projectedTarget < 8.0) projectedTarget = 8.0 + (score > 75 ? 6.5 : 2.5);
            slPercent = 3.5;
          }

          const slPrice = Number((currentPrice * (1 - slPercent / 100)).toPrecision(5));
          const rrRatio = `1:${(projectedTarget / slPercent).toFixed(1)}`;

          if (score >= 40) {
            rawCandidates.push({
              symbol: coin.symbol,
              price: currentPrice,
              score: Math.min(100, Math.round(score)),
              reasons,
              bbw: (bb.bandwidth * 100).toFixed(2),
              target: projectedTarget.toFixed(1),
              tradeType,
              holdingPeriod,
              slPrice,
              slPercent: `${slPercent.toFixed(1)}%`,
              riskReward: rrRatio,
              volSpikeRatio: `${volRatio.toFixed(1)}x`,
              rsiValue: rsi,
              trendDirection: currentPrice > ema50 && ema9 && ema21 && ema9 > ema21 ? 'strong_up' : 'breakout',
            });

            // Live sort and update top 30
            const sortedTop30 = [...rawCandidates]
              .sort((a, b) => b.score - a.score)
              .slice(0, 30)
              .map((c, idx) => ({ ...c, rank: idx + 1 }));

            setCandidates(sortedTop30);
          }
        } catch (err: unknown) {
          if ((err as Error)?.name === 'AbortError') break;
        }

        // Adaptive pause to protect IP
        await new Promise((r) => setTimeout(r, 60));
      }

      if (!abortController.signal.aborted) {
        if (rawCandidates.length === 0) {
          setStatusMessage(<span className="text-gray-400">لا توجد صفقات مطابقة في الوقت الحالي</span>);
        } else {
          setStatusMessage(
            <span className="text-emerald-400 font-bold">
              ✅ تم فرز وتحديد أفضل {Math.min(30, rawCandidates.length)} صفقة خارقة في السوق! 🎯
            </span>
          );
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        console.error('Scanning error', err);
        setStatusMessage(<span className="text-brand-red">حدث خطأ في الاتصال، جرب مجدداً</span>);
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Filter & Search Candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((coin) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toUpperCase();
        if (!coin.symbol.includes(q)) return false;
      }

      // Type filter
      if (filterType === 'scalp') return coin.tradeType === 'SCALP';
      if (filterType === 'swing') return coin.tradeType === 'SWING_1_2_DAYS';
      if (filterType === 'elite') return coin.score >= 78;
      return true;
    });
  }, [candidates, filterType, searchQuery]);

  // Quick statistics of the top 30
  const stats = useMemo(() => {
    const total = candidates.length;
    const scalpCount = candidates.filter((c) => c.tradeType === 'SCALP').length;
    const swingCount = candidates.filter((c) => c.tradeType === 'SWING_1_2_DAYS').length;
    const avgTarget =
      total > 0
        ? (candidates.reduce((sum, c) => sum + parseFloat(c.target), 0) / total).toFixed(1)
        : '0.0';
    const topScore = total > 0 ? candidates[0].score : 0;
    return { total, scalpCount, swingCount, avgTarget, topScore };
  }, [candidates]);

  return (
    <div className="flex flex-col gap-6">
      {/* Intro Banner */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-900 to-blue-950/40 rounded-xl p-5 border-r-4 border-r-brand-cyan border border-gray-800 shadow-xl flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="w-7 h-7 rounded-lg bg-brand-cyan/20 border border-brand-cyan/40 flex items-center justify-center">
              <Layers className="w-4 h-4 text-brand-cyan" />
            </div>
            <h2 className="text-base font-black text-white">
              النظام 2: رادار الصفقات الخارق ⚡ (أفضل 30 صفقة في السوق)
            </h2>
            <span className="bg-brand-gold/15 text-brand-gold border border-brand-gold/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Flame className="w-3 h-3 fill-current" />
              TOP 30 Opportunities
            </span>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">
            محرك كوانت متطور يفحص سيولة وسيادة السوق لحظة بلحظة للبحث عن{' '}
            <span className="text-brand-cyan font-bold">الانضغاط القاتل (Squeeze)</span> و{' '}
            <span className="text-brand-gold font-bold">دخول الحيتان (Whale Volume)</span>.
            يقوم بتصنيف وترتيب أفضل 30 فرصة نقية بين{' '}
            <span className="text-yellow-400 font-bold">سكالبينج خاطف (+4% إلى +7.5%)</span> و{' '}
            <span className="text-cyan-400 font-bold">سوينغ مدة يوم أو يومين أقصى حد (+8% إلى +22%+)</span>.
          </p>

          <div className="flex items-center gap-4 mt-3 text-[11px] font-bold text-gray-400">
            <span className="flex items-center gap-1 text-emerald-400">
              <Zap className="w-3.5 h-3.5" />
              سكالبينج: 1m / 5m / 15m
            </span>
            <span className="flex items-center gap-1 text-blue-400">
              <Calendar className="w-3.5 h-3.5" />
              سوينغ يوم/يومين: 1h / 4h
            </span>
            <span className="flex items-center gap-1 text-purple-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              حساب وقف الخسارة ونسبة R:R تلقائياً
            </span>
          </div>
        </div>

        {/* Scan Controls Box */}
        <div className="flex flex-col gap-2.5 shrink-0 w-full md:w-80 bg-gray-950 p-3.5 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="radar-timeframe" className="text-xs text-gray-300 font-bold flex items-center gap-1">
              <Clock className="w-3 h-3 text-brand-cyan" />
              إطار الفحص:
            </label>
            <select
              id="radar-timeframe"
              value={timeframe}
              disabled={isScanning}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-brand-cyan text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-cyan font-bold cursor-pointer disabled:opacity-50"
            >
              <optgroup label="⚡ فريمات السكالبينج الخاطف (+4%)">
                <option value="1m">1 دقيقة (سكالبينج خاطف ⚡)</option>
                <option value="5m">5 دقائق (سكالبينج سريع ⚡)</option>
                <option value="15m">15 دقيقة (سكالبينج تكتيكي ⚡)</option>
              </optgroup>
              <optgroup label="🚀 فريمات سوينغ يوم أو يومين (+8% إلى +22%)">
                <option value="1h">1 ساعة (سوينغ 24h - 48h 🚀)</option>
                <option value="4h">4 ساعات (سوينغ يومين 🚀)</option>
                <option value="1d">1 يوم (سوينغ أسبوعي 🌊)</option>
              </optgroup>
            </select>
          </div>

          <button
            onClick={startScan}
            className={`font-black py-2.5 px-5 rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
              isScanning
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30'
                : 'bg-gradient-to-r from-brand-cyan to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning
              ? 'إيقاف الفحص'
              : hasScanned
              ? 'إعادة مسح أفضل 30 صفقة 🎯'
              : 'بدء مسح أفضل 30 صفقة خارقة 🚀'}
          </button>

          <div className="text-[10px] font-bold text-center text-gray-400 bg-gray-900/80 px-2 py-1 rounded border border-gray-800">
            {statusMessage}
          </div>
        </div>
      </div>

      {/* Progress Animation */}
      {isScanning && (
        <div className="flex flex-col items-center justify-center py-10 bg-gray-900 rounded-xl border border-gray-800 relative overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-brand-cyan/5 pulse-circle"></div>
          <div className="relative w-16 h-16 mb-3">
            <div className="radar-scan-anim"></div>
            <div className="absolute inset-1.5 border-2 border-brand-cyan/40 rounded-full"></div>
            <div className="absolute inset-0 flex items-center justify-center text-brand-cyan font-black text-lg">
              {progress}%
            </div>
          </div>
          <h3 className="text-sm font-black text-white mb-1">جاري تصفية وفرز أفضل 30 صفقة في السوق...</h3>
          <p className="text-xs text-brand-cyan font-mono mb-3 h-4 text-center">{currentCoinText}</p>

          <div className="w-72 bg-gray-950 rounded-full h-2 border border-gray-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-l from-brand-cyan via-blue-500 to-brand-gold transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {hasScanned && (
        <div className="flex flex-col gap-4">
          {/* Quick Statistics Strip */}
          {candidates.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-900 border border-gray-800 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-gray-400 font-bold">أفضل الصفقات المرصودة</div>
                  <div className="text-lg font-black text-white font-mono">{stats.total} / 30</div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                  🎯
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-yellow-400 font-bold">صفقات سكالبينج خاطف ⚡</div>
                  <div className="text-lg font-black text-yellow-400 font-mono">{stats.scalpCount}</div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 text-yellow-400 flex items-center justify-center font-bold">
                  ⚡
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-cyan-400 font-bold">سوينغ يوم أو يومين 🚀</div>
                  <div className="text-lg font-black text-cyan-400 font-mono">{stats.swingCount}</div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">
                  🚀
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-emerald-400 font-bold">متوسط الأرباح المتوقعة</div>
                  <div className="text-lg font-black text-emerald-400 font-mono dir-ltr">+{stats.avgTarget}%</div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                  📈
                </div>
              </div>
            </div>
          )}

          {/* Controls Bar: Filters & View Modes */}
          <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
            {/* Filter Pills */}
            <div className="flex items-center flex-wrap gap-1.5 w-full md:w-auto">
              <span className="text-xs font-bold text-gray-400 ml-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> تصفية:
              </span>
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterType === 'all'
                    ? 'bg-brand-blue text-white shadow-sm'
                    : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                الكل ({candidates.length})
              </button>
              <button
                onClick={() => setFilterType('scalp')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  filterType === 'scalp'
                    ? 'bg-yellow-500 text-black shadow-sm'
                    : 'bg-gray-950 text-yellow-400/80 hover:text-yellow-400 border border-gray-800'
                }`}
              >
                <Zap className="w-3 h-3" /> سكالبينج خاطف ({stats.scalpCount})
              </button>
              <button
                onClick={() => setFilterType('swing')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  filterType === 'swing'
                    ? 'bg-cyan-500 text-black shadow-sm'
                    : 'bg-gray-950 text-cyan-400/80 hover:text-cyan-400 border border-gray-800'
                }`}
              >
                <Calendar className="w-3 h-3" /> سوينغ يوم/يومين ({stats.swingCount})
              </button>
              <button
                onClick={() => setFilterType('elite')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  filterType === 'elite'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-gray-950 text-purple-400/80 hover:text-purple-400 border border-gray-800'
                }`}
              >
                <Flame className="w-3 h-3" /> النخبة 80%+
              </button>
            </div>

            {/* Search and View Mode Switcher */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <div className="relative w-44">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="ابحث عن عملة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-950 border border-gray-800 text-white text-xs rounded-lg pr-8 pl-2 py-1.5 outline-none focus:border-brand-blue w-full font-mono uppercase"
                />
              </div>

              <div className="flex items-center bg-gray-950 border border-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  title="عرض البطاقات"
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'grid' ? 'bg-gray-800 text-brand-cyan' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  title="عرض الجدول الاحترافي"
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'table' ? 'bg-gray-800 text-brand-cyan' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  <TableIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Empty State */}
          {filteredCandidates.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-gray-900 rounded-xl border border-gray-800 p-6">
              <Layers className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="font-bold text-sm mb-1 text-white">لا توجد صفقات تطابق خيارات التصفية الحالية</p>
              <p className="text-xs text-gray-500">
                جرب تغيير إطار الفحص أو التبديل إلى &quot;كافة الصفقات&quot; لإظهار الفرص المتاحة.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            /* 1. Grid Cards View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCandidates.map((coin) => {
                const isTop3 = (coin.rank || 99) <= 3;
                const isTop10 = (coin.rank || 99) <= 10;
                const isScalp = coin.tradeType === 'SCALP';
                const isAdded = !!addedSymbols[coin.symbol];

                const rankMedal =
                  coin.rank === 1
                    ? '🥇'
                    : coin.rank === 2
                    ? '🥈'
                    : coin.rank === 3
                    ? '🥉'
                    : `#${coin.rank}`;

                return (
                  <div
                    key={coin.symbol}
                    className={`bg-gray-900 rounded-xl border ${
                      isTop3
                        ? 'border-brand-gold/60 shadow-[0_0_20px_rgba(245,158,11,0.15)] bg-gradient-to-b from-gray-900 to-amber-950/20'
                        : isTop10
                        ? 'border-brand-cyan/40 hover:border-brand-cyan shadow-md'
                        : 'border-gray-800 hover:border-gray-700 shadow-sm'
                    } p-4 transition-all duration-300 flex flex-col justify-between relative group`}
                  >
                    {/* Card Header */}
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                              isTop3
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-gray-800 text-gray-300 border border-gray-700'
                            }`}
                          >
                            {rankMedal}
                          </span>
                          <div>
                            <h3 className="text-lg font-black text-white leading-none font-mono">
                              {coin.symbol}
                            </h3>
                            <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                              السعر: {coin.price.toPrecision(5)}
                            </span>
                          </div>
                        </div>

                        {/* Trade Type Badge & Score */}
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                              isScalp
                                ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                                : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                            }`}
                          >
                            {isScalp ? <Zap className="w-2.5 h-2.5" /> : <Calendar className="w-2.5 h-2.5" />}
                            {isScalp ? 'سكالبينج خاطف ⚡' : 'سوينغ يوم/يومين 🚀'}
                          </span>
                          <span className="text-[9px] text-gray-500 font-bold">{coin.holdingPeriod}</span>
                        </div>
                      </div>

                      {/* Main Targets Grid */}
                      <div className="grid grid-cols-3 gap-2 bg-gray-950 p-2.5 rounded-lg border border-gray-800/80 mb-3 text-center">
                        <div>
                          <span className="text-[9px] text-emerald-400 font-bold block mb-0.5">
                            الهدف المتوقع
                          </span>
                          <span className="text-xs font-black text-emerald-400 font-mono dir-ltr">
                            +{coin.target}% 🚀
                          </span>
                        </div>

                        <div>
                          <span className="text-[9px] text-rose-400 font-bold block mb-0.5">
                            وقف الخسارة
                          </span>
                          <span className="text-xs font-black text-rose-400 font-mono dir-ltr">
                            -{coin.slPercent}
                          </span>
                        </div>

                        <div>
                          <span className="text-[9px] text-brand-gold font-bold block mb-0.5">
                            العائد/المخاطرة
                          </span>
                          <span className="text-xs font-black text-brand-gold font-mono dir-ltr">
                            {coin.riskReward}
                          </span>
                        </div>
                      </div>

                      {/* Secondary Technical Indicators */}
                      <div className="grid grid-cols-3 gap-2 mb-3 text-[10px]">
                        <div className="bg-gray-950/60 p-1.5 rounded border border-gray-800/60 text-center">
                          <span className="text-[9px] text-gray-500 block">قوة الصفقة</span>
                          <span className="font-bold text-white font-mono">{coin.score}%</span>
                        </div>
                        <div className="bg-gray-950/60 p-1.5 rounded border border-gray-800/60 text-center">
                          <span className="text-[9px] text-gray-500 block">انضغاط الباند</span>
                          <span className="font-bold text-cyan-300 font-mono">{coin.bbw}%</span>
                        </div>
                        <div className="bg-gray-950/60 p-1.5 rounded border border-gray-800/60 text-center">
                          <span className="text-[9px] text-gray-500 block">فوليوم الحيتان</span>
                          <span className="font-bold text-amber-300 font-mono">{coin.volSpikeRatio}</span>
                        </div>
                      </div>

                      {/* Technical Reasons */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {coin.reasons.map((r, i) => (
                          <span
                            key={i}
                            className="text-[9px] bg-gray-950 border border-gray-800 px-2 py-1 rounded text-gray-300 truncate"
                            title={r}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-800/80">
                      {onAddTrade && (
                        <button
                          onClick={() => handleCaptureTrade(coin)}
                          disabled={isAdded}
                          className={`flex-1 font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ${
                            isAdded
                              ? 'bg-emerald-600 text-white cursor-default'
                              : isScalp
                              ? 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black'
                              : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> تم الخطف!
                            </>
                          ) : (
                            <>
                              <PlusCircle className="w-3.5 h-3.5" />
                              خطف الصفقة للنظام
                            </>
                          )}
                        </button>
                      )}

                      <a
                        href={`https://www.binance.com/ar/trade/${coin.symbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors shrink-0"
                        title="فحص الشارت على باينانس"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 2. Quant Matrix Table View */
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-950 border-b border-gray-800 text-[11px] text-gray-400 font-bold">
                      <th className="py-3 px-3 text-center w-12"># الرتبة</th>
                      <th className="py-3 px-4">الرمز والسعر</th>
                      <th className="py-3 px-3 text-center">نوع الصفقة والمدة</th>
                      <th className="py-3 px-3 text-center">القوة</th>
                      <th className="py-3 px-3 text-center">الهدف المتوقع</th>
                      <th className="py-3 px-3 text-center">وقف الخسارة</th>
                      <th className="py-3 px-3 text-center">العائد/المخاطرة</th>
                      <th className="py-3 px-4">أسباب الانفجار</th>
                      <th className="py-3 px-3 text-center">إجراء فوري</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 text-xs font-medium">
                    {filteredCandidates.map((coin) => {
                      const isTop3 = (coin.rank || 99) <= 3;
                      const isScalp = coin.tradeType === 'SCALP';
                      const isAdded = !!addedSymbols[coin.symbol];

                      return (
                        <tr
                          key={coin.symbol}
                          className={`hover:bg-gray-800/50 transition-colors ${
                            isTop3 ? 'bg-amber-950/10' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center font-bold">
                            <span
                              className={`w-6 h-6 rounded inline-flex items-center justify-center font-black text-xs ${
                                coin.rank === 1
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : coin.rank === 2
                                  ? 'bg-gray-300/20 text-gray-200'
                                  : coin.rank === 3
                                  ? 'bg-amber-700/20 text-amber-500'
                                  : 'text-gray-400'
                              }`}
                            >
                              {coin.rank === 1
                                ? '🥇'
                                : coin.rank === 2
                                ? '🥈'
                                : coin.rank === 3
                                ? '🥉'
                                : coin.rank}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-mono font-black text-white text-sm">{coin.symbol}</div>
                            <div className="text-[10px] text-gray-400 font-mono">
                              {coin.price.toPrecision(5)}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isScalp
                                  ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                                  : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                              }`}
                            >
                              {isScalp ? 'سكالبينج ⚡' : 'سوينغ 1-2 يوم 🚀'}
                            </span>
                            <div className="text-[9px] text-gray-500 mt-0.5">{coin.holdingPeriod}</div>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-bold text-white bg-gray-950 px-2 py-1 rounded border border-gray-800">
                              {coin.score}%
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400 dir-ltr">
                            +{coin.target}% 🚀
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold text-rose-400 dir-ltr">
                            -{coin.slPercent}
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold text-brand-gold dir-ltr">
                            {coin.riskReward}
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {coin.reasons.slice(0, 2).map((r, i) => (
                                <span
                                  key={i}
                                  className="text-[9px] bg-gray-950 px-1.5 py-0.5 rounded text-gray-400 border border-gray-800"
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {onAddTrade && (
                                <button
                                  onClick={() => handleCaptureTrade(coin)}
                                  disabled={isAdded}
                                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                    isAdded
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-brand-blue hover:bg-blue-600 text-white'
                                  }`}
                                >
                                  {isAdded ? 'تم الخطف' : 'خطف ⚡'}
                                </button>
                              )}
                              <a
                                href={`https://www.binance.com/ar/trade/${coin.symbol}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
                                title="عرض على باينانس"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
