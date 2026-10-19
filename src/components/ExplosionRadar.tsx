import React, { useState, useRef } from 'react';
import { ExternalLink, RefreshCw, Layers } from 'lucide-react';
import { ExplosionCandidate } from '../types';

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

export const ExplosionRadar: React.FC = () => {
  const [timeframe, setTimeframe] = useState('1h');
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentCoinText, setCurrentCoinText] = useState('تهيئة محرك البحث...');
  const [candidates, setCandidates] = useState<ExplosionCandidate[]>([]);
  const [statusMessage, setStatusMessage] = useState<React.ReactNode>('جاهز لبدء المسح...');
  const [hasScanned, setHasScanned] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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
        يمسح السوق الشامل ({timeframe.toUpperCase()}) 🔍
      </span>
    );

    const foundCandidates: ExplosionCandidate[] = [];

    try {
      setCurrentCoinText('جلب خريطة السيولة من باينانس...');
      
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
        const fallbackRes = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
          signal: abortController.signal,
        });
        if (fallbackRes.ok) {
          tickers = await fallbackRes.json();
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

      const targetCoins = tickers.filter((t: { symbol: string; lastPrice: string; quoteVolume: string }) => {
        return (
          t.symbol.endsWith('USDT') &&
          parseFloat(t.lastPrice) > 0.001 &&
          parseFloat(t.quoteVolume) > 3000000 &&
          !stableCoins.includes(t.symbol)
        );
      });

      targetCoins.sort(
        (a: { quoteVolume: string }, b: { quoteVolume: string }) =>
          parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)
      );

      for (let i = 0; i < targetCoins.length; i++) {
        if (abortController.signal.aborted) break;

        const coin = targetCoins[i];
        setCurrentCoinText(
          `تحليل (${timeframe.toUpperCase()}): ${coin.symbol} (${i + 1}/${targetCoins.length})`
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

          if (!Array.isArray(klines) || klines.length < 52) {
            const fallbackRes = await fetch(
              `https://api.binance.com/api/v3/klines?symbol=${coin.symbol}&interval=${timeframe}&limit=100`,
              { signal: abortController.signal }
            );
            if (fallbackRes.ok) {
              klines = await fallbackRes.json();
            }
          }

          if (!Array.isArray(klines) || klines.length < 52) continue;

          const closes = klines.map((k: (string | number)[]) => parseFloat(k[4] as string));
          const volumes = klines.map((k: (string | number)[]) => parseFloat(k[5] as string));

          const currentPrice = closes[closes.length - 1];
          const closedCloses = closes.slice(0, -1);
          const closedVolumes = volumes.slice(0, -1);

          const bb = calcBollinger(closedCloses, 20, 2);
          const ema50 = calcEMA(closedCloses, 50);
          const ema9 = calcEMA(closedCloses, 9);
          const ema21 = calcEMA(closedCloses, 21);
          const volAvg20 = calcSMA(closedVolumes, 20);

          if (!bb || !ema50 || !volAvg20 || currentPrice <= 0) continue;

          const currentVol = closedVolumes[closedVolumes.length - 1];
          let score = 0;
          const reasons: string[] = [];

          // Squeeze
          const isSqueezing = bb.bandwidth < 0.08;
          if (isSqueezing) {
            score += 40;
            reasons.push('انضغاط سعري حاد (Squeeze)');
          } else if (bb.bandwidth < 0.12) {
            score += 25;
            reasons.push('تجهيز لانفجار سعري');
          }

          // Whale Volume
          const volRatio = volAvg20 > 0 ? currentVol / volAvg20 : 1;
          if (volRatio > 3.0) {
            score += 35;
            reasons.push('دخول سيولة حيتان مفاجئة');
          } else if (volRatio > 1.5) {
            score += 15;
            reasons.push('ارتفاع ملحوظ في الفوليوم');
          }

          // Trend Alignment
          if (currentPrice > ema50) {
            score += 20;
            reasons.push('تمركز أعلى المتوسط (EMA50)');
          }

          // Turbo Scalp 4%+ Detection for 1m, 5m, 15m
          const isScalpTf = ['1m', '5m', '15m'].includes(timeframe);
          let isTurboScalpMatch = false;
          if (isScalpTf && ema9 && ema21) {
            if (ema9 > ema21 && currentPrice > ema9 && volRatio >= 1.6) {
              isTurboScalpMatch = true;
              score += 25;
              reasons.push('⚡ استراتيجية السكالبينج الخاطف (فرصة +4%)');
            }
          }

          // Distance to upper BB
          const distToUpperBB = ((bb.upper - currentPrice) / currentPrice) * 100;
          if (distToUpperBB > 1 && distToUpperBB < 15) {
            score += 10;
          }

          if (score >= 45 && (bb.bandwidth < 0.16 || isTurboScalpMatch)) {
            // Expected target projection (ensures 4%+ on scalp setups or realistic positive target)
            let projectedTarget = distToUpperBB > 0.5
              ? distToUpperBB
              : Math.max(2.0, bb.bandwidth * 50);

            if (isTurboScalpMatch && projectedTarget < 4.0) {
              projectedTarget = Math.max(4.0, (bb.bandwidth * 60));
            }

            foundCandidates.push({
              symbol: coin.symbol,
              price: currentPrice,
              score: Math.min(100, Math.round(score)),
              reasons: reasons,
              bbw: (bb.bandwidth * 100).toFixed(2),
              target: projectedTarget.toFixed(1),
            });
            // Update live candidates sorted by score
            setCandidates([...foundCandidates].sort((a, b) => b.score - a.score));
          }
        } catch (err: unknown) {
          if ((err as Error)?.name === 'AbortError') {
            break;
          }
        }

        // Safe pause between coin requests to protect IP rate limit
        await new Promise((r) => setTimeout(r, 70));
      }

      if (!abortController.signal.aborted) {
        if (foundCandidates.length === 0) {
          setStatusMessage(<span className="text-gray-400">لا توجد انفجارات وشيكة</span>);
        } else {
          setStatusMessage(
            <span className="text-brand-cyan">تم رصد {foundCandidates.length} فرصة 🔥</span>
          );
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        console.error('Scanning error', err);
        setStatusMessage(<span className="text-brand-red">حدث خطأ في الاتصال</span>);
      }
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Intro Banner */}
      <div className="bg-gray-900 rounded-xl p-5 border-r-4 border-r-brand-cyan flex flex-col md:flex-row gap-6 items-center shadow-lg">
        <div className="flex-1">
          <h2 className="text-sm font-black text-white mb-2 flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand-cyan/20 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-brand-cyan" />
            </div>
            النظام 2: رادار الانفجارات الشامل (Swing)
          </h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            هذا الرادار منفصل ويعمل من متصفحك مباشرة. يقوم بمسح{' '}
            <span className="text-brand-cyan font-bold">كافة العملات النشطة في السوق</span> التي
            تمتلك سيولة حقيقية (فوق 3 مليون$) للبحث عن{' '}
            <span className="text-brand-neon font-bold">الانضغاط القاتل (Squeeze)</span> و{' '}
            <span className="text-brand-blue font-bold">دخول الحيتان السري</span>.
            <br />
            <span className="text-[10px] text-brand-gold mt-1 block font-bold">
              🛡️ نظام الحماية: يتم فحص العملات بتأخير زمني آمن لمنع حظر الـ IP. قد يستغرق المسح بضع
              ثوانٍ.
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
          <div className="flex items-center gap-2 mb-1 justify-between bg-gray-950 p-1.5 rounded-lg border border-gray-800">
            <label htmlFor="radar-timeframe" className="text-[10px] text-gray-400 font-bold ml-1">
              إطار البحث:
            </label>
            <select
              id="radar-timeframe"
              value={timeframe}
              disabled={isScanning}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-brand-cyan text-xs rounded-md px-2 py-1 outline-none focus:border-brand-cyan font-bold cursor-pointer disabled:opacity-50"
            >
              <option value="1m">1 دقيقة (سكالبينج خاطف ⚡)</option>
              <option value="5m">5 دقائق (سكالبينج)</option>
              <option value="15m">15 دقيقة (سريع)</option>
              <option value="1h">1 ساعة (متوسط)</option>
              <option value="4h">4 ساعات (سوينج)</option>
              <option value="1d">1 يوم (استثمار)</option>
            </select>
          </div>

          <button
            onClick={startScan}
            className={`font-black py-2.5 px-6 rounded-lg text-sm flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(6,182,212,0.1)] transition-all cursor-pointer ${
              isScanning
                ? 'bg-red-500/20 text-brand-red border border-red-500/50 hover:bg-red-500/30'
                : 'bg-gray-800 hover:bg-gray-700 text-brand-cyan border border-brand-cyan/50 hover:border-brand-cyan'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning
              ? 'إيقاف المسح'
              : hasScanned
              ? 'إعادة المسح الشامل'
              : 'بدء المسح الشامل (Global Scan)'}
          </button>

          <div className="text-[10px] font-bold text-center text-gray-400 bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-800">
            {statusMessage}
          </div>
        </div>
      </div>

      {/* Scanner Radar Progress */}
      {isScanning && (
        <div className="flex flex-col items-center justify-center py-12 bg-gray-900 rounded-xl border border-gray-800 relative overflow-hidden shadow-lg">
          <div className="absolute inset-0 bg-brand-cyan/5 pulse-circle"></div>
          <div className="relative w-16 h-16 mb-4">
            <div className="radar-scan-anim"></div>
            <div className="absolute inset-1.5 border-2 border-brand-cyan/30 rounded-full"></div>
            <div className="absolute inset-0 flex items-center justify-center text-brand-cyan font-black text-lg">
              {progress}%
            </div>
          </div>
          <h3 className="text-sm font-black text-white mb-1">جاري المسح الشامل للسوق...</h3>
          <p className="text-xs text-brand-cyan font-mono mb-4 h-4">{currentCoinText}</p>

          <div className="w-64 bg-gray-950 rounded-full h-2 border border-gray-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-l from-brand-cyan to-brand-blue transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Results Container */}
      {hasScanned && !isScanning && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="text-brand-gold">🎯</span> أفضل العملات المرشحة للانفجار ({candidates.length})
            </h2>
            <span className="text-[10px] text-gray-400 bg-gray-950 px-2 py-1 rounded border border-gray-800">
              ترتيب تنازلي حسب القوة
            </span>
          </div>

          {candidates.length === 0 ? (
            <div className="col-span-full text-center py-16 text-gray-500 bg-gray-900 rounded-xl border border-gray-800 font-bold text-sm">
              السوق هادئ جداً أو متذبذب حالياً على إطار {timeframe.toUpperCase()}، من بين كافة العملات لا توجد عملة تتطابق مع شروط الانفجار الصارمة. جرب فريماً آخر.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {candidates.map((coin) => {
                const isNeon = coin.score >= 80;
                const isCyan = coin.score >= 60 && !isNeon;
                const scoreColorClass = isNeon
                  ? 'text-brand-neon border-brand-neon shadow-[0_0_10px_rgba(204,255,0,0.2)]'
                  : isCyan
                  ? 'text-brand-cyan border-brand-cyan'
                  : 'text-brand-blue border-brand-blue';

                const borderTopClass = isNeon ? 'border-t-brand-neon' : 'border-t-brand-cyan';

                return (
                  <div
                    key={coin.symbol}
                    className={`bg-gray-900 p-5 rounded-xl border-t-2 ${borderTopClass} transition-all duration-300 flex flex-col justify-between h-full shadow-md hover:bg-gray-800`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-black text-white leading-none">
                            {coin.symbol}
                          </h3>
                          <span className="text-[10px] text-gray-500 font-mono mt-1 block">
                            السعر: {coin.price.toPrecision(5)}
                          </span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div
                            className={`text-xl font-black bg-gray-950 w-12 h-12 flex items-center justify-center rounded-full border ${scoreColorClass}`}
                          >
                            {coin.score}
                          </div>
                          <span className="text-[7px] text-gray-500 uppercase font-bold mt-1 tracking-wider">
                            قوة الإشارة
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gray-950 border border-gray-800 rounded-lg p-2 text-center">
                          <div className="text-[9px] text-gray-500 font-bold mb-1">نسبة الانضغاط</div>
                          <div className="text-xs font-black text-white font-mono">{coin.bbw}%</div>
                        </div>
                        <div className="bg-brand-cyan/5 border border-brand-cyan/30 rounded-lg p-2 text-center relative overflow-hidden">
                          <div className="text-[9px] text-brand-cyan font-bold mb-1 relative z-10">
                            الهدف المتوقع
                          </div>
                          <div className="text-xs font-black text-brand-cyan font-mono relative z-10">
                            +{coin.target}% 🚀
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 mb-4">
                        <div className="flex flex-wrap gap-1">
                          {coin.reasons.map((r, i) => (
                            <span
                              key={i}
                              className="text-[9px] bg-gray-950 border border-gray-800 px-2 py-1.5 rounded text-gray-400 flex-1 text-center truncate"
                              title={r}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <a
                      href={`https://www.binance.com/ar/trade/${coin.symbol}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white transition-colors font-bold text-[11px] py-2 rounded flex items-center justify-center gap-1.5 mt-auto border border-gray-700"
                    >
                      فحص على باينانس
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
