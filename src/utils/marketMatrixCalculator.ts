import { MarketHealthData, TimeframeMatrixScore } from '../types';

export const calcEMA = (data: number[], period: number): number | null => {
  if (!data || data.length < period) return null;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
};

export const calcSMA = (data: number[], period: number): number | null => {
  if (!data || data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
};

export const calcRSI = (closes: number[], period: number = 14): number | null => {
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

interface KlinePoint {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const parseKlines = (raw: any[]): KlinePoint[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((k) => ({
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
};

const evaluateTf = (
  tf: '1m' | '5m' | '15m' | '1h' | '4h',
  klines: KlinePoint[],
  label: string
): TimeframeMatrixScore => {
  if (!klines || klines.length === 0) {
    return {
      tf,
      score: 50,
      status: 'neutral',
      rsi: 50,
      trend: 'flat',
      volRatio: 1,
      label,
    };
  }

  const closes = klines.map((k) => k.close);
  const volumes = klines.map((k) => k.volume);
  const currentPrice = closes[closes.length - 1];
  const closedCloses = closes.slice(0, -1);
  const closedVolumes = volumes.slice(0, -1);

  const rsi = Math.round(calcRSI(closedCloses, 14) || 50);
  const volSma = calcSMA(closedVolumes, 20) || closedVolumes[closedVolumes.length - 1] || 1;
  const currentVol = closedVolumes[closedVolumes.length - 1] || 1;
  const volRatio = Number((currentVol / volSma).toFixed(2));

  let score = 30; // base
  let trend: 'up' | 'down' | 'flat' = 'flat';

  if (tf === '4h') {
    // Macro 4h Institutional Evaluation: EMA50 & EMA200
    const ema50 = calcEMA(closedCloses, 50);
    const ema200 = calcEMA(closedCloses, Math.min(200, closedCloses.length - 1));

    if (ema200 && currentPrice > ema200) {
      score += 25;
      trend = 'up';
    } else if (ema200 && currentPrice < ema200 * 0.98) {
      score -= 20;
      trend = 'down';
    }

    if (ema50 && ema200 && ema50 > ema200) {
      score += 20; // Golden cross macro
      trend = 'up';
    }

    if (ema50 && currentPrice > ema50) {
      score += 15;
    }

    // Macro RSI
    if (rsi >= 50 && rsi <= 66) score += 20;
    else if (rsi > 66 && rsi <= 76) score += 12;
    else if (rsi < 40) score -= 15;

    // Macro volume
    if (volRatio >= 1.2) score += 10;
  } else if (tf === '1h') {
    // 1h Daily Trend & Swing Structure: EMA20 & EMA50
    const ema20 = calcEMA(closedCloses, 20) || currentPrice;
    const ema50 = calcEMA(closedCloses, Math.min(50, closedCloses.length - 1)) || currentPrice;

    if (currentPrice > ema50 && ema20 > ema50) {
      trend = 'up';
      score += 40;
    } else if (currentPrice < ema50 && ema20 < ema50) {
      trend = 'down';
      score -= 20;
    } else {
      trend = 'flat';
      score += 10;
    }

    if (rsi >= 48 && rsi <= 68) score += 25;
    else if (rsi > 68 && rsi <= 78) score += 12;
    else if (rsi < 42) score -= 15;

    if (volRatio >= 1.3) score += 15;
    else if (volRatio >= 0.9) score += 8;
  } else {
    // Micro Execution (1m, 5m, 15m)
    const ema9 = calcEMA(closedCloses, 9) || currentPrice;
    const ema21 = calcEMA(closedCloses, 21) || currentPrice;
    const ema50 = calcEMA(closedCloses, Math.min(50, closedCloses.length - 1)) || currentPrice;

    if (currentPrice > ema9 && ema9 > ema21) {
      trend = 'up';
      score += 35;
      if (currentPrice > ema50) score += 10;
    } else if (currentPrice < ema9 && ema9 < ema21) {
      trend = 'down';
      score -= 15;
    } else {
      trend = 'flat';
      score += 10;
    }

    // RSI sweetspot for scalping (50-68)
    if (rsi >= 50 && rsi <= 68) {
      score += 25;
    } else if (rsi > 68 && rsi <= 78) {
      score += 15;
    } else if (rsi > 78) {
      score -= 10;
    } else if (rsi >= 40 && rsi < 50) {
      score += 5;
    } else {
      score -= 15;
    }

    if (volRatio >= 1.5) score += 15;
    else if (volRatio >= 1.0) score += 8;
  }

  score = Math.max(5, Math.min(100, Math.round(score)));

  let status: 'bullish' | 'neutral' | 'bearish' = 'neutral';
  if (score >= 65) status = 'bullish';
  else if (score < 45) status = 'bearish';

  return {
    tf,
    score,
    status,
    rsi,
    trend,
    volRatio,
    label,
  };
};

export const fetchLiveMarketMatrix = async (): Promise<MarketHealthData | null> => {
  try {
    const [res1m, res5m, res15m, res1h, res4h] = await Promise.all([
      fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100'),
      fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=100'),
      fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=100'),
      fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100'),
      fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=100'),
    ]);

    if (!res1m.ok || !res5m.ok || !res15m.ok) return null;

    const [data1m, data5m, data15m, data1h, data4h] = await Promise.all([
      res1m.json(),
      res5m.json(),
      res15m.json(),
      res1h.ok ? res1h.json() : [],
      res4h.ok ? res4h.json() : [],
    ]);

    const klines1m = parseKlines(data1m);
    const klines5m = parseKlines(data5m);
    const klines15m = parseKlines(data15m);
    const klines1h = parseKlines(data1h);
    const klines4h = parseKlines(data4h);

    // Evaluate Micro Execution Timeframes
    const score1m = evaluateTf('1m', klines1m, 'نبض الزخم اللحظي (1m)');
    const score5m = evaluateTf('5m', klines5m, 'تأكيد مسار الحركة (5m)');
    const score15m = evaluateTf('15m', klines15m, 'قاعدة الهدف 4%+ (15m)');

    // Evaluate Macro Strategic Timeframes (4h & 1h)
    const score1h = evaluateTf('1h', klines1h, 'المسار اليومي والزخم (1h)');
    const score4h = evaluateTf('4h', klines4h, 'الاتجاه الماكرو المؤسسي (4h)');

    // 1. Macro Composite (55% 4h + 45% 1h)
    const macroScore = Math.round(score4h.score * 0.55 + score1h.score * 0.45);
    let macroStatus: 'bullish' | 'neutral' | 'bearish' = 'neutral';
    if (macroScore >= 65) macroStatus = 'bullish';
    else if (macroScore < 48) macroStatus = 'bearish';

    // 2. Micro Scalp Composite (40% 15m + 35% 5m + 25% 1m)
    const microScore = Math.round(
      score15m.score * 0.4 + score5m.score * 0.35 + score1m.score * 0.25
    );
    let microStatus: 'bullish' | 'neutral' | 'bearish' = 'neutral';
    if (microScore >= 65) microStatus = 'bullish';
    else if (microScore < 48) microStatus = 'bearish';

    // 3. Overall Market Matrix Composite: 40% Macro + 60% Micro
    let compositeScore = Math.round(macroScore * 0.4 + microScore * 0.6);
    compositeScore = Math.max(5, Math.min(100, compositeScore));

    // 4. Multi-Timeframe Synergy Analysis
    const all5Bullish =
      score4h.status === 'bullish' &&
      score1h.status === 'bullish' &&
      score15m.status === 'bullish' &&
      score5m.status === 'bullish' &&
      score1m.status === 'bullish';

    const all5Bearish =
      score4h.status === 'bearish' &&
      score1h.status === 'bearish' &&
      score15m.status === 'bearish' &&
      score5m.status === 'bearish' &&
      score1m.status === 'bearish';

    let macroMicroSynergy: 'PERFECT_5_TF' | 'STRONG_TREND' | 'MIXED_DIVERGENCE' | 'BEARISH_DANGER' =
      'MIXED_DIVERGENCE';
    let synergyLabel = 'تباين بين الماكرو والمايكرو: تذبذب مع ارتدادات محدودة';

    if (all5Bullish || (macroStatus === 'bullish' && microStatus === 'bullish' && compositeScore >= 75)) {
      macroMicroSynergy = 'PERFECT_5_TF';
      synergyLabel = '🔥🔥 توافق خماسي مثالي (4h + 1h + 15m + 5m + 1m): أقصى درجات أمان وانفجار صفقات +4%';
    } else if (macroStatus === 'bullish' && microStatus !== 'bearish') {
      macroMicroSynergy = 'STRONG_TREND';
      synergyLabel = '🚀 الاتجاه العام صاعد (4h/1h): السكالبينج اللحظي مدعوم بقوة مؤسسية';
    } else if (macroStatus === 'bearish' && microStatus === 'bullish') {
      macroMicroSynergy = 'MIXED_DIVERGENCE';
      synergyLabel = '⚠️ تحذير فخ صعودي (Bull Trap): الماكرو (4h) هابط بينما المايكرو صاعد، التزم بوقف الخسارة بدقة';
    } else if (macroStatus === 'bearish' && microStatus === 'bearish') {
      macroMicroSynergy = 'BEARISH_DANGER';
      synergyLabel = '🔴 خطر شامل (سلبية الماكرو والمايكرو): الحماية الآلية نشطة لمنع الخسائر';
    }

    let alignment: 'full' | 'partial' | 'divergent' = 'partial';
    if (all5Bullish) alignment = 'full';
    else if (all5Bearish || macroMicroSynergy === 'MIXED_DIVERGENCE') alignment = 'divergent';

    const scalpOpportunity =
      (macroStatus === 'bullish' && microScore >= 60) ||
      (microStatus === 'bullish' && compositeScore >= 65);

    let status = 'neutral';
    if (compositeScore >= 70 && macroStatus !== 'bearish') {
      status = 'bullish';
    } else if (compositeScore < 48 || macroStatus === 'bearish') {
      status = 'bearish';
    }

    let recommendation = synergyLabel;
    if (macroMicroSynergy === 'PERFECT_5_TF') {
      recommendation =
        '🔥🔥 بيئة تداول أسطورية: صعود الحيتان (4h & 1h) يتطابق مع زخم السكالبينج (15m & 5m & 1m)! اقتنص صفقات +4% بثقة.';
    } else if (macroMicroSynergy === 'STRONG_TREND') {
      recommendation =
        '⚡ اتجاه ماكرو قوي: استغل موجات 1m و 5m السريعة للدخول مع اتجاه اليوم وساعة الصفر، الأهداف تمتد لـ 4% فأكثر.';
    } else if (macroMicroSynergy === 'MIXED_DIVERGENCE') {
      recommendation =
        '⚠️ تباين الأطر الزمنية: ارتداد لحظي عكس اتجاه 4h، اكتفِ بأهداف سريعة وحرك وقف الخسارة فوراً لحجز الأرباح.';
    }

    return {
      score: compositeScore,
      status,
      matrix: {
        '1m': score1m,
        '5m': score5m,
        '15m': score15m,
        '1h': score1h,
        '4h': score4h,
      },
      macroScore,
      microScore,
      macroStatus,
      microStatus,
      macroMicroSynergy,
      synergyLabel,
      alignment,
      scalpOpportunity,
      recommendation,
      targetProjection:
        macroMicroSynergy === 'PERFECT_5_TF'
          ? '+5.0% - +9.0%'
          : scalpOpportunity
          ? '+4.0% - +6.5%'
          : '+2.5% - +4.0%',
      log: [{ score: compositeScore, time: Date.now() }],
    };
  } catch (e) {
    console.error('Error fetching live 5-timeframe market matrix:', e);
    return null;
  }
};
